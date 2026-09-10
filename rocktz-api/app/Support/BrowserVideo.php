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

    public static function ffmpegBinary(): ?string
    {
        return Ffmpeg::binary();
    }

    public static function mp4Key(string $key): string
    {
        return (string) preg_replace('/\.(mov|qt|m4v)$/i', '.mp4', $key);
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
            return null;
        }

        $target = $source.'.browser.mp4';
        $info = self::videoInfo($source);
        $copy = self::canStreamCopy($info);

        $command = $copy
            ? escapeshellcmd($ffmpeg).' -y -i '.escapeshellarg($source)
                .' -map 0:v:0 -map 0:a? -c copy -movflags +faststart -f mp4 '.escapeshellarg($target).' 2>/dev/null'
            : self::previewCommand($ffmpeg, $source, $target);

        exec($command, $output, $code);
        if ($code !== 0 || ! is_file($target) || (int) filesize($target) < 32) {
            @unlink($target);
            if ($copy) {
                return self::transcodePreview($ffmpeg, $source, $target);
            }

            return null;
        }

        return $target;
    }

    /**
     * @return array{path: string, size: int}|null
     */
    public static function ensurePlayable(string $key): ?array
    {
        if (! self::ffmpegBinary()) {
            return null;
        }

        $mp4Key = self::mp4Key($key);
        foreach (self::disks() as $disk) {
            if ($mp4Key !== $key && $disk->exists($mp4Key)) {
                return ['path' => $mp4Key, 'size' => (int) $disk->size($mp4Key)];
            }
        }
        if (! self::needsTranscode($key)) {
            foreach (self::disks() as $disk) {
                if ($disk->exists($key)) {
                    return ['path' => $key, 'size' => (int) $disk->size($key)];
                }
            }

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

                if (! self::writePreview($disk, $mp4Key, $converted)) {
                    return null;
                }

                return ['path' => $mp4Key, 'size' => (int) $disk->size($mp4Key)];
            } finally {
                if ($source['cleanup']) {
                    @unlink($source['path']);
                }
            }
        }

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
                if (is_string($local) && is_file($local)) {
                    return ['path' => $local, 'cleanup' => false];
                }
            }
        } catch (Throwable) {
            // Remote disks have no local path.
        }

        $temp = tempnam(sys_get_temp_dir(), 'rzvid');
        if ($temp === false) {
            return null;
        }
        $source = $temp.'.src';
        @unlink($temp);
        $in = $disk->readStream($key);
        if ($in === false) {
            return null;
        }
        $out = fopen($source, 'wb');
        if ($out === false) {
            if (is_resource($in)) {
                fclose($in);
            }

            return null;
        }
        stream_copy_to_stream($in, $out);
        fclose($out);
        if (is_resource($in)) {
            fclose($in);
        }

        return ['path' => $source, 'cleanup' => true];
    }

    private static function writePreview(Filesystem $disk, string $mp4Key, string $converted): bool
    {
        $put = fopen($converted, 'rb');
        if ($put === false) {
            @unlink($converted);

            return false;
        }
        try {
            return (bool) $disk->writeStream($mp4Key, $put);
        } finally {
            if (is_resource($put)) {
                fclose($put);
            }
            @unlink($converted);
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
            escapeshellcmd($ffprobe).' -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 '.escapeshellarg($path)
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

    private static function previewCommand(string $ffmpeg, string $source, string $target): string
    {
        return escapeshellcmd($ffmpeg).' -y -i '.escapeshellarg($source)
            .' -map 0:v:0 -map 0:a? -c:v libx264 -preset ultrafast -crf 28 -r 30 -pix_fmt yuv420p'
            .' -vf '.escapeshellarg('scale=1280:1280:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2')
            .' -c:a aac -ac 2 -b:a 96k -movflags +faststart -f mp4 '.escapeshellarg($target).' 2>/dev/null';
    }

    private static function transcodePreview(string $ffmpeg, string $source, string $target): ?string
    {
        exec(self::previewCommand($ffmpeg, $source, $target), $output, $code);
        if ($code !== 0 || ! is_file($target) || (int) filesize($target) < 32) {
            @unlink($target);

            return null;
        }

        return $target;
    }
}
