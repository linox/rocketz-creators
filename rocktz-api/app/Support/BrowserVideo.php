<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
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
                self::ensureLocalPoster($disk, $key, $mp4Key);

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

    private static function extractPoster(string $source): ?string
    {
        $ffmpeg = self::ffmpegBinary();
        if ($ffmpeg === null || ! is_file($source)) {
            return null;
        }

        $target = $source.'.poster.jpg';
        foreach (['0.8', '0'] as $at) {
            $command = escapeshellarg($ffmpeg).' -hide_banner -y -ss '.$at.' -i '.escapeshellarg($source)
                .' -frames:v 1 -q:v 5 -vf '.escapeshellarg('scale=720:720:force_original_aspect_ratio=decrease')
                .' '.escapeshellarg($target);
            if (self::ranOk($command, $target, false) && (int) filesize($target) > 32) {
                return $target;
            }
            @unlink($target);
        }

        return null;
    }

    private static function ensureLocalPoster(Filesystem $disk, string $key, string $mp4Key): void
    {
        $posterKey = self::posterKey($key);
        try {
            if ($disk->exists($posterKey) || ! method_exists($disk, 'path')) {
                return;
            }
            $local = $disk->path($mp4Key);
            if (! is_string($local) || ! is_file($local)) {
                return;
            }
            $poster = self::extractPoster($local);
            if ($poster !== null) {
                self::writePreview($disk, $posterKey, $poster);
            }
        } catch (Throwable) {
            //
        }
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
