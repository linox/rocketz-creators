<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Throwable;

class BrowserVideo
{
    public const PREVIEW_EDGE = 1280;

    /** @var list<string> */
    private const COPY_CODECS = ['h264', 'avc1', 'vp8', 'vp9', 'av1'];

    private static ?string $lastError = null;

    public static function lastError(): ?string
    {
        return self::$lastError;
    }

    public static function ffmpegBinary(): ?string
    {
        return Ffmpeg::binary();
    }

    public static function mp4Key(string $key): string
    {
        return (string) preg_replace('/\.(mov|qt|m4v)$/i', '.mp4', $key);
    }

    public static function posterKey(string $key): string
    {
        return (string) preg_replace('/\.[^.]+$/', '.jpg', self::mp4Key($key));
    }

    public static function needsTranscode(string $key): bool
    {
        return (bool) preg_match('/\.(mov|qt|m4v)$/i', $key);
    }

    /**
     * Start a preview conversion without blocking the request that opened the video.
     * The media queue is not consumed by the scheduler, so the player cannot wait on it.
     */
    public static function kick(string $key): void
    {
        if (! self::needsTranscode($key) || app()->runningUnitTests() || ! self::ffmpegBinary()) {
            return;
        }
        if (Cache::has(self::previewLock($key)) || Cache::has(self::previewFail($key))) {
            return;
        }
        if (! Cache::add(self::previewSpawn($key), 1, 45)) {
            return;
        }

        self::spawnArtisan('media:make-playable '.escapeshellarg($key));
    }

    public static function holdPreview(string $key): bool
    {
        return Cache::add(self::previewLock($key), 1, 1800);
    }

    public static function releasePreview(string $key): void
    {
        Cache::forget(self::previewLock($key));
        Cache::forget(self::previewSpawn($key));
    }

    /**
     * Store one JPEG beside the video. Later screens reuse that file.
     */
    public static function kickPoster(string $key): void
    {
        if (app()->runningUnitTests() || ! self::ffmpegBinary() || self::posterReady($key)) {
            return;
        }
        if (Cache::has(self::posterLock($key)) || Cache::has(self::posterFail($key))) {
            return;
        }
        if (! Cache::add(self::posterSpawn($key), 1, 120)) {
            return;
        }
        if (! function_exists('exec') || ! self::acquirePosterSlot($key)) {
            Cache::forget(self::posterSpawn($key));

            return;
        }

        self::spawnArtisan('media:make-poster '.escapeshellarg($key));
    }

    public static function hasLocalSource(string $key): bool
    {
        $located = self::locateVideo($key);

        return $located !== null && self::hasLocalFile($located['disk'], $located['key']);
    }

    public static function savePosterBeside(Filesystem $disk, string $videoKey, string $absolute): bool
    {
        if (app()->runningUnitTests() || ! is_file($absolute) || self::posterReady($videoKey)) {
            return self::posterReady($videoKey);
        }

        $poster = self::extractPoster($absolute);
        if ($poster === null) {
            return false;
        }

        return self::writePreview($disk, self::posterKey($videoKey), $poster);
    }

    public static function resolveCliBinary(?string $running = null): string
    {
        $running ??= PHP_BINARY;
        if (self::isCliBinary($running)) {
            return $running;
        }

        $candidates = [];
        if ($running !== '') {
            $candidates[] = dirname($running, 2).DIRECTORY_SEPARATOR.'bin'.DIRECTORY_SEPARATOR.'php';
            $candidates[] = dirname($running).DIRECTORY_SEPARATOR.'php';
        }
        $candidates[] = PHP_BINDIR.DIRECTORY_SEPARATOR.'php';

        foreach ($candidates as $path) {
            if (self::isCliBinary($path)) {
                return $path;
            }
        }

        $which = trim((string) @shell_exec('command -v php 2>/dev/null'));
        if (self::isCliBinary($which)) {
            return $which;
        }

        return 'php';
    }

    public static function releaseSlotFor(string $key): void
    {
        for ($i = 0; $i < 2; $i++) {
            if (Cache::get(self::posterSlot($i)) === $key) {
                Cache::forget(self::posterSlot($i));
            }
        }
    }

    public static function holdPoster(string $key): bool
    {
        return Cache::add(self::posterLock($key), 1, 1800);
    }

    public static function releasePoster(string $key): void
    {
        Cache::forget(self::posterLock($key));
        Cache::forget(self::posterSpawn($key));
    }

    public static function markPosterFailed(string $key): void
    {
        Cache::put(self::posterFail($key), self::lastError() ?: 'failed', now()->addMinutes(2));
    }

    public static function posterReady(string $key): bool
    {
        $posterKey = self::posterKey($key);
        foreach (self::disks() as $disk) {
            if (self::storedOk($disk, $posterKey)) {
                return true;
            }
        }

        return false;
    }

    public static function ensurePoster(string $key): bool
    {
        if (self::posterReady($key)) {
            return true;
        }
        if (! self::ffmpegBinary()) {
            self::rememberError('ffmpeg not found');

            return false;
        }

        $located = self::locateVideo($key);
        if ($located === null) {
            self::rememberError('source not found');

            return false;
        }

        if (! self::hasLocalFile($located['disk'], $located['key'])) {
            $remotePoster = self::extractPosterFromRemote($located['key']);
            if ($remotePoster !== null && self::writePreview($located['disk'], self::posterKey($key), $remotePoster)) {
                return true;
            }
        }

        if (self::posterReady($key)) {
            return true;
        }

        $source = self::materializeSource($located['disk'], $located['key']);
        if ($source === null) {
            return false;
        }

        try {
            if (self::posterReady($key)) {
                return true;
            }
            $poster = self::extractPoster($source['path']);
            if ($poster === null) {
                self::rememberError(self::lastError() ?: 'poster failed');

                return false;
            }

            return self::writePreview($located['disk'], self::posterKey($key), $poster);
        } finally {
            if ($source['cleanup']) {
                @unlink($source['path']);
            }
        }
    }

    public static function markPreviewFailed(string $key): void
    {
        Cache::put(self::previewFail($key), self::lastError() ?: 'failed', now()->addMinutes(2));
    }

    private static function previewLock(string $key): string
    {
        return 'media-preview:'.sha1($key);
    }

    private static function previewSpawn(string $key): string
    {
        return 'media-preview-spawn:'.sha1($key);
    }

    private static function previewFail(string $key): string
    {
        return 'media-preview-fail:'.sha1($key);
    }

    private static function posterLock(string $key): string
    {
        return 'media-poster:'.sha1($key);
    }

    private static function posterSpawn(string $key): string
    {
        return 'media-poster-spawn:'.sha1($key);
    }

    private static function posterFail(string $key): string
    {
        return 'media-poster-fail:'.sha1($key);
    }

    /**
     * @return array{disk: Filesystem, key: string}|null
     */
    private static function locateVideo(string $key): ?array
    {
        $candidates = array_values(array_unique([self::mp4Key($key), $key]));
        foreach ($candidates as $candidate) {
            if (! preg_match('/\.(mp4|mov|qt|m4v|webm)$/i', $candidate)) {
                continue;
            }
            foreach (self::disks() as $disk) {
                try {
                    if ($disk->exists($candidate) && (int) $disk->size($candidate) > 32) {
                        return ['disk' => $disk, 'key' => $candidate];
                    }
                } catch (Throwable) {
                    //
                }
            }
        }

        return null;
    }

    /**
     * Convert a local video to a browser-playable H.264 AAC MP4 preview.
     * Returns the mp4 path, or null if ffmpeg is missing / conversion failed.
     */
    public static function transcodeToMp4(string $source): ?string
    {
        $ffmpeg = self::ffmpegBinary();
        if ($ffmpeg === null || ! is_file($source)) {
            self::rememberError($ffmpeg === null ? 'ffmpeg not found' : 'source file missing');

            return null;
        }

        $target = $source.'.browser.mp4';
        $info = self::videoInfo($source);
        if (self::canStreamCopy($info) && self::ranOk(self::copyCommand($ffmpeg, $source, $target), $target)) {
            return $target;
        }
        @unlink($target);

        foreach (self::previewCommands($ffmpeg, $source, $target) as $command) {
            if (self::ranOk($command, $target)) {
                return $target;
            }
            @unlink($target);
        }

        return null;
    }

    /**
     * @return array{path: string, size: int}|null
     */
    public static function ensurePlayable(string $key): ?array
    {
        self::$lastError = null;

        if (! self::ffmpegBinary()) {
            self::rememberError('ffmpeg not found');

            return null;
        }

        $mp4Key = self::mp4Key($key);
        foreach (self::disks() as $disk) {
            if ($mp4Key !== $key && $disk->exists($mp4Key) && (int) $disk->size($mp4Key) > 32) {
                self::ensurePoster($key);

                return ['path' => $mp4Key, 'size' => (int) $disk->size($mp4Key)];
            }
        }
        if (! self::needsTranscode($key)) {
            foreach (self::disks() as $disk) {
                if ($disk->exists($key)) {
                    return ['path' => $key, 'size' => (int) $disk->size($key)];
                }
            }
            self::rememberError('source not found');

            return null;
        }

        foreach (self::disks() as $disk) {
            if (! $disk->exists($key)) {
                continue;
            }

            $source = self::materializeSource($disk, $key);
            if ($source === null) {
                return null;
            }

            try {
                $converted = self::transcodeToMp4($source['path']);
                if ($converted === null) {
                    return null;
                }

                $poster = self::extractPoster($converted);
                if (! self::writePreview($disk, $mp4Key, $converted)) {
                    if ($poster !== null) {
                        @unlink($poster);
                    }

                    return null;
                }
                if ($poster !== null) {
                    self::writePreview($disk, self::posterKey($key), $poster);
                }

                self::$lastError = null;

                return ['path' => $mp4Key, 'size' => (int) $disk->size($mp4Key)];
            } finally {
                if ($source['cleanup']) {
                    @unlink($source['path']);
                }
            }
        }

        self::rememberError('source not found');

        return null;
    }

    /**
     * @return array{path: string, size: int}|null
     */
    public static function ensureRemotePlayable(string $key): ?array
    {
        return self::ensurePlayable($key);
    }

    /**
     * @return list<Filesystem>
     */
    private static function disks(): array
    {
        $names = [MediaDisk::name(), 'uploads'];
        if (MediaDisk::r2Configured()) {
            $names[] = 'r2';
        }

        $disks = [];
        foreach (array_unique($names) as $name) {
            try {
                $disks[] = Storage::disk($name);
            } catch (Throwable) {
                //
            }
        }

        return $disks;
    }

    /**
     * @return array{path: string, cleanup: bool}|null
     */
    private static function materializeSource(Filesystem $disk, string $key): ?array
    {
        try {
            if (method_exists($disk, 'path')) {
                $local = $disk->path($key);
                if (is_string($local) && is_file($local) && filesize($local) > 32) {
                    return ['path' => $local, 'cleanup' => false];
                }
            }
        } catch (Throwable) {
            // Remote disks have no local path.
        }

        $dir = storage_path('app/tmp');
        if (! is_dir($dir) && ! @mkdir($dir, 0755, true) && ! is_dir($dir)) {
            self::rememberError('could not create temp dir');

            return null;
        }

        $source = $dir.'/'.bin2hex(random_bytes(8)).'.src';
        $in = $disk->readStream($key);
        if ($in === false) {
            self::rememberError('could not download '.$key);

            return null;
        }
        $out = fopen($source, 'wb');
        if ($out === false) {
            if (is_resource($in)) {
                fclose($in);
            }
            self::rememberError('could not write temp file');

            return null;
        }
        stream_copy_to_stream($in, $out);
        fclose($out);
        if (is_resource($in)) {
            fclose($in);
        }

        $bytes = is_file($source) ? (int) filesize($source) : 0;
        $expected = 0;
        try {
            $expected = (int) $disk->size($key);
        } catch (Throwable) {
            //
        }
        if ($bytes < 32 || ($expected > 32 && $bytes < $expected)) {
            @unlink($source);
            self::rememberError('incomplete download '.$key.' ('.$bytes.' of '.$expected.' bytes)');

            return null;
        }

        return ['path' => $source, 'cleanup' => true];
    }

    private static function writePreview(Filesystem $disk, string $mp4Key, string $converted): bool
    {
        try {
            if (! is_file($converted) || (int) filesize($converted) < 32) {
                self::rememberError('preview file was empty');

                return false;
            }

            $put = fopen($converted, 'rb');
            if ($put === false) {
                self::rememberError('could not read preview file');

                return false;
            }
            try {
                $disk->writeStream($mp4Key, $put);
            } finally {
                if (is_resource($put)) {
                    fclose($put);
                }
            }

            if (self::storedOk($disk, $mp4Key)) {
                return true;
            }

            $contents = file_get_contents($converted);
            if ($contents === false) {
                self::rememberError('could not read preview file');

                return false;
            }
            $disk->put($mp4Key, $contents);

            if (self::storedOk($disk, $mp4Key)) {
                return true;
            }

            self::rememberError('failed to store '.$mp4Key);

            return false;
        } catch (Throwable $e) {
            self::rememberError($e->getMessage());

            return false;
        } finally {
            @unlink($converted);
        }
    }

    private static function storedOk(Filesystem $disk, string $key): bool
    {
        try {
            return $disk->exists($key) && (int) $disk->size($key) > 32;
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * @return array{codec: ?string, width: int, height: int}
     */
    private static function videoInfo(string $path): array
    {
        $ffprobe = Ffmpeg::probeBinary();
        if ($ffprobe === null) {
            return ['codec' => null, 'width' => 0, 'height' => 0];
        }

        $raw = trim((string) shell_exec(
            escapeshellarg($ffprobe).' -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 '.escapeshellarg($path).' 2>/dev/null'
        ));
        $parts = array_map('trim', explode(',', $raw));

        return [
            'codec' => ($parts[0] ?? '') !== '' ? strtolower($parts[0]) : null,
            'width' => (int) ($parts[1] ?? 0),
            'height' => (int) ($parts[2] ?? 0),
        ];
    }

    /**
     * @param  array{codec: ?string, width: int, height: int}  $info
     */
    private static function canStreamCopy(array $info): bool
    {
        $codec = $info['codec'];
        if ($codec === null || ! in_array($codec, self::COPY_CODECS, true)) {
            return false;
        }

        $edge = max($info['width'], $info['height']);

        return $edge > 0 && $edge <= self::PREVIEW_EDGE;
    }

    private static function copyCommand(string $ffmpeg, string $source, string $target): string
    {
        return self::ffmpegPrefix($ffmpeg, $source)
            .' -map 0:v:0 -map 0:a:0? -c copy -movflags +faststart -f mp4 '.escapeshellarg($target);
    }

    /**
     * @return list<string>
     */
    private static function previewCommands(string $ffmpeg, string $source, string $target): array
    {
        $scale = 'scale='.self::PREVIEW_EDGE.':'.self::PREVIEW_EDGE.':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p';
        $small = 'scale=720:720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p';

        return [
            self::encodeCommand($ffmpeg, $source, $target, $scale, true),
            self::encodeCommand($ffmpeg, $source, $target, $scale, false),
            self::encodeCommand($ffmpeg, $source, $target, $small, false),
        ];
    }

    private static function encodeCommand(string $ffmpeg, string $source, string $target, string $vf, bool $audio): string
    {
        $maps = $audio
            ? ' -map 0:v:0 -map 0:a:0? -c:a aac -ac 2 -ar 44100 -b:a 96k'
            : ' -map 0:v:0 -an';

        return self::ffmpegPrefix($ffmpeg, $source)
            .$maps
            .' -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p'
            .' -vf '.escapeshellarg($vf)
            .' -movflags +faststart -max_muxing_queue_size 2048 -f mp4 '.escapeshellarg($target);
    }

    private static function ffmpegPrefix(string $ffmpeg, string $source): string
    {
        return escapeshellarg($ffmpeg).' -hide_banner -y -fflags +genpts -i '.escapeshellarg($source);
    }

    private static function ranOk(string $command, string $target, bool $recordError = true): bool
    {
        $output = [];
        $code = 0;
        exec($command.' 2>&1', $output, $code);
        if ($code === 0 && is_file($target) && (int) filesize($target) >= 32) {
            return true;
        }
        if ($recordError) {
            self::rememberError(self::errorFromOutput($output, $code));
        }

        return false;
    }

    /**
     * @param  list<string>  $lines
     */
    private static function errorFromOutput(array $lines, int $code): string
    {
        $lines = array_values(array_filter(array_map('trim', $lines)));
        foreach (array_reverse($lines) as $line) {
            if (preg_match('/error|failed|invalid|impossible|cannot|not found|killed|denied|unrecognized/i', $line)) {
                return $line;
            }
        }
        if ($lines !== []) {
            return $lines[array_key_last($lines)];
        }

        return $code === 137 || $code === 9 ? 'ffmpeg killed (out of memory)' : 'ffmpeg failed (exit '.$code.')';
    }

    private static function hasLocalFile(Filesystem $disk, string $key): bool
    {
        try {
            if (method_exists($disk, 'path')) {
                $local = $disk->path($key);
                if (is_string($local) && is_file($local) && filesize($local) > 32) {
                    return true;
                }
            }
        } catch (Throwable) {
            // Remote disks have no local path.
        }

        return false;
    }

    private static function extractPosterFromRemote(string $key): ?string
    {
        $signed = MediaUrl::signedGet($key);
        if (! is_string($signed) || ! str_starts_with($signed, 'https://')) {
            return null;
        }

        return self::extractPoster($signed);
    }

    private static function extractPoster(string $source): ?string
    {
        $ffmpeg = self::ffmpegBinary();
        $remote = preg_match('#\Ahttps?://#i', $source) === 1;
        if ($ffmpeg === null || (! $remote && ! is_file($source))) {
            return null;
        }

        $target = $remote ? self::tempPosterPath() : $source.'.poster.jpg';
        if ($target === null) {
            return null;
        }

        $commands = [];
        foreach (['1', '0.2'] as $at) {
            $commands[] = self::posterCommand($ffmpeg, $source, $target, $at, $remote, true);
        }
        if (! $remote) {
            $commands[] = self::posterCommand($ffmpeg, $source, $target, '1', false, false);
        }

        foreach ($commands as $command) {
            if (self::ranOk($command, $target, false) && (int) filesize($target) > 32) {
                return $target;
            }
            @unlink($target);
        }

        return null;
    }

    private static function posterCommand(string $ffmpeg, string $source, string $target, string $at, bool $remote, bool $seekInput): string
    {
        $input = escapeshellarg($source);
        $seek = $seekInput ? '-ss '.$at.' -i '.$input : '-i '.$input.' -ss '.$at;
        $network = $remote ? ' -rw_timeout 20000000' : '';

        return escapeshellarg($ffmpeg).' -hide_banner -y'.$network.' '.$seek
            .' -frames:v 1 -q:v 5 -vf '.escapeshellarg('scale=720:720:force_original_aspect_ratio=decrease')
            .' '.escapeshellarg($target);
    }

    private static function spawnArtisan(string $arguments): void
    {
        if (! function_exists('exec')) {
            return;
        }

        $command = 'nohup '.escapeshellarg(self::resolveCliBinary()).' '.escapeshellarg(base_path('artisan')).' '.$arguments;
        $log = storage_path('logs/media-preview.log');
        exec($command.' >> '.escapeshellarg($log).' 2>&1 &');
    }

    private static function acquirePosterSlot(string $key): bool
    {
        for ($i = 0; $i < 2; $i++) {
            if (Cache::add(self::posterSlot($i), $key, now()->addMinutes(3))) {
                return true;
            }
        }

        return false;
    }

    private static function posterSlot(int $index): string
    {
        return 'media-poster-slot:'.$index;
    }

    private static function isCliBinary(string $path): bool
    {
        if ($path === '' || ! is_file($path)) {
            return false;
        }
        $base = strtolower(basename($path));
        if ($base !== 'php' && $base !== 'php.exe') {
            return false;
        }
        if (! is_executable($path)) {
            @chmod($path, 0755);
        }

        return is_executable($path);
    }

    private static function tempPosterPath(): ?string
    {
        $dir = storage_path('app/tmp');
        if (! is_dir($dir) && ! @mkdir($dir, 0755, true) && ! is_dir($dir)) {
            self::rememberError('could not create temp dir');

            return null;
        }

        return $dir.'/'.bin2hex(random_bytes(8)).'.poster.jpg';
    }

    private static function rememberError(string $message): void
    {
        $message = trim((string) preg_replace('/\s+/', ' ', $message));
        if ($message === '') {
            return;
        }
        self::$lastError = mb_substr($message, 0, 400);
    }
}
