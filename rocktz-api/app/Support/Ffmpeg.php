<?php

namespace App\Support;

class Ffmpeg
{
    public static function binary(): ?string
    {
        return self::firstExecutable([
            (string) config('media.ffmpeg_path'),
            base_path('bin/ffmpeg'),
            storage_path('app/bin/ffmpeg'),
            '/usr/local/bin/ffmpeg',
            '/usr/bin/ffmpeg',
            '/bin/ffmpeg',
            self::which('ffmpeg'),
        ]);
    }

    public static function probeBinary(): ?string
    {
        $ffmpeg = self::binary();
        $beside = $ffmpeg ? dirname($ffmpeg).'/ffprobe' : '';

        return self::firstExecutable([
            (string) config('media.ffprobe_path'),
            base_path('bin/ffprobe'),
            storage_path('app/bin/ffprobe'),
            $beside,
            '/usr/local/bin/ffprobe',
            '/usr/bin/ffprobe',
            '/bin/ffprobe',
            self::which('ffprobe'),
        ]);
    }

    public static function installHint(): string
    {
        return implode("\n", [
            'Não precisa instalar pacote no WHM/cPanel.',
            'O deploy coloca ffmpeg em public_html/bin/, ou envie os dois arquivos pelo File Manager:',
            '  /home/apicreatorzdig/public_html/bin/ffmpeg',
            '  /home/apicreatorzdig/public_html/bin/ffprobe',
            'Permissão: 755. Depois:',
            '/opt/cpanel/ea-php84/root/usr/bin/php artisan media:make-playable portfolio/video-20260909181647-p5nv4ebq.mov',
        ]);
    }

    /**
     * @param  list<string>  $candidates
     */
    private static function firstExecutable(array $candidates): ?string
    {
        foreach ($candidates as $path) {
            $path = trim($path);
            if ($path === '' || ! is_file($path)) {
                continue;
            }
            if (! is_executable($path)) {
                @chmod($path, 0755);
            }
            if (is_executable($path)) {
                return $path;
            }
        }

        return null;
    }

    private static function which(string $name): string
    {
        $found = trim((string) @shell_exec('command -v '.escapeshellarg($name).' 2>/dev/null'));

        return $found;
    }
}
