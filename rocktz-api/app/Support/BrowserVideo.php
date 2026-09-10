<?php

namespace App\Support;

use App\Models\MediaFile;
use Illuminate\Support\Facades\Storage;
use Throwable;

class BrowserVideo
{
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
     * Convert a local video to H.264 AAC MP4. Returns the mp4 path, or null if
     * ffmpeg is missing / conversion failed.
     */
    public static function transcodeToMp4(string $source): ?string
    {
        $ffmpeg = self::ffmpegBinary();
        if ($ffmpeg === null || ! is_file($source)) {
            return null;
        }

        $target = $source.'.browser.mp4';
        $codec = self::videoCodec($source);
        $copy = $codec !== null && in_array($codec, ['h264', 'avc1', 'vp8', 'vp9', 'av1'], true);

        $command = $copy
            ? escapeshellcmd($ffmpeg).' -y -i '.escapeshellarg($source)
                .' -map 0:v:0 -map 0:a? -c copy -movflags +faststart -f mp4 '.escapeshellarg($target).' 2>/dev/null'
            : escapeshellcmd($ffmpeg).' -y -i '.escapeshellarg($source)
                .' -map 0:v:0 -map 0:a? -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p'
                .' -c:a aac -ac 2 -b:a 128k -movflags +faststart -f mp4 '.escapeshellarg($target).' 2>/dev/null';

        exec($command, $output, $code);
        if ($code !== 0 || ! is_file($target) || (int) filesize($target) < 32) {
            @unlink($target);
            if ($copy) {
                return self::transcodeForced($ffmpeg, $source, $target);
            }

            return null;
        }

        return $target;
    }

    /**
     * @return array{path: string, size: int}|null
     */
    public static function ensureRemotePlayable(string $key): ?array
    {
        if (! MediaDisk::r2Configured() || ! self::ffmpegBinary()) {
            return null;
        }

        $mp4Key = self::mp4Key($key);
        $disk = Storage::disk('r2');
        if ($mp4Key !== $key && $disk->exists($mp4Key)) {
            return ['path' => $mp4Key, 'size' => (int) $disk->size($mp4Key)];
        }
        if (! self::needsTranscode($key) && $disk->exists($key)) {
            return ['path' => $key, 'size' => (int) $disk->size($key)];
        }
        if (! $disk->exists($key)) {
            return null;
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

        try {
            $converted = self::transcodeToMp4($source);
            if ($converted === null) {
                return null;
            }

            $put = fopen($converted, 'rb');
            if ($put === false) {
                @unlink($converted);

                return null;
            }
            try {
                $ok = $disk->writeStream($mp4Key, $put);
            } finally {
                if (is_resource($put)) {
                    fclose($put);
                }
                @unlink($converted);
            }
            if (! $ok) {
                return null;
            }

            $size = (int) $disk->size($mp4Key);
            self::rewriteStoredUrls($key, $mp4Key, $size);

            return ['path' => $mp4Key, 'size' => $size];
        } finally {
            @unlink($source);
        }
    }

    public static function rewriteStoredUrls(string $fromKey, string $toKey, int $size): void
    {
        $fromUrl = MediaUrl::playback($fromKey);
        $toUrl = MediaUrl::playback($toKey);

        MediaFile::query()->where('path', $fromKey)->update([
            'path' => $toKey,
            'filename' => basename($toKey),
            'mime_type' => 'video/mp4',
            'size' => $size,
        ]);

        foreach (MediaRestore::urlColumns() as $column) {
            try {
                \Illuminate\Support\Facades\DB::table($column['table'])
                    ->where($column['column'], 'like', '%'.$fromKey.'%')
                    ->update([$column['column'] => $toUrl]);
            } catch (Throwable) {
                //
            }
        }

        foreach (MediaRestore::jsonColumns() as $column) {
            try {
                $rows = \Illuminate\Support\Facades\DB::table($column['table'])->whereNotNull($column['column'])->get(['id', $column['column']]);
                foreach ($rows as $row) {
                    $raw = $row->{$column['column']};
                    if (! is_string($raw) || (! str_contains($raw, $fromKey) && ! str_contains($raw, $fromUrl))) {
                        continue;
                    }
                    $next = str_replace([$fromUrl, $fromKey], [$toUrl, $toKey], $raw);
                    \Illuminate\Support\Facades\DB::table($column['table'])->where('id', $row->id)->update([$column['column'] => $next]);
                }
            } catch (Throwable) {
                //
            }
        }
    }

    private static function videoCodec(string $path): ?string
    {
        $ffprobe = Ffmpeg::probeBinary();
        if ($ffprobe === null) {
            return null;
        }

        $codec = trim((string) shell_exec(
            escapeshellcmd($ffprobe).' -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 '.escapeshellarg($path)
        ));

        return $codec !== '' ? strtolower($codec) : null;
    }

    private static function transcodeForced(string $ffmpeg, string $source, string $target): ?string
    {
        $command = escapeshellcmd($ffmpeg).' -y -i '.escapeshellarg($source)
            .' -map 0:v:0 -map 0:a? -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p'
            .' -c:a aac -ac 2 -b:a 128k -movflags +faststart -f mp4 '.escapeshellarg($target).' 2>/dev/null';
        exec($command, $output, $code);
        if ($code !== 0 || ! is_file($target) || (int) filesize($target) < 32) {
            @unlink($target);

            return null;
        }

        return $target;
    }
}
