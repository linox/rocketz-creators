<?php

namespace App\Console\Commands;

use App\Support\Ffmpeg;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Throwable;

class MediaInstallFfmpegCommand extends Command
{
    protected $signature = 'media:install-ffmpeg';

    protected $description = 'Download a static ffmpeg/ffprobe into storage/app/bin for MOV transcoding';

    public function handle(): int
    {
        $dir = storage_path('app/bin');
        if (! is_dir($dir) && ! mkdir($dir, 0755, true) && ! is_dir($dir)) {
            $this->error('Could not create '.$dir);

            return self::FAILURE;
        }

        $arch = php_uname('m');
        $url = str_contains($arch, 'aarch64') || str_contains($arch, 'arm64')
            ? 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz'
            : 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';

        $archive = storage_path('app/ffmpeg-static.tar.xz');
        $this->line('Downloading '.$url);
        try {
            $response = Http::timeout(120)->sink($archive)->get($url);
            if (! $response->successful() || ! is_file($archive) || filesize($archive) < 1000) {
                $this->error('Download failed. Install manually:');
                $this->line(Ffmpeg::installHint());

                return self::FAILURE;
            }
        } catch (Throwable $e) {
            $this->error($e->getMessage());
            $this->line(Ffmpeg::installHint());

            return self::FAILURE;
        }

        $extract = storage_path('app/ffmpeg-extract');
        if (is_dir($extract)) {
            $this->deleteDir($extract);
        }
        mkdir($extract, 0755, true);

        $untar = 'tar -xJf '.escapeshellarg($archive).' -C '.escapeshellarg($extract);
        exec($untar, $out, $code);
        if ($code !== 0) {
            $this->error('tar failed. Need xz/tar on the server. '.$untar);
            $this->line(Ffmpeg::installHint());

            return self::FAILURE;
        }

        $copied = 0;
        foreach (['ffmpeg', 'ffprobe'] as $bin) {
            $matches = glob($extract.'/*/'.$bin) ?: [];
            $source = $matches[0] ?? null;
            if (! is_string($source) || ! is_file($source)) {
                continue;
            }
            $dest = $dir.'/'.$bin;
            copy($source, $dest);
            chmod($dest, 0755);
            $copied++;
            $this->info($dest);
        }

        @unlink($archive);
        $this->deleteDir($extract);

        if ($copied < 1 || ! Ffmpeg::binary()) {
            $this->error('ffmpeg still not executable. '.$dir);
            $this->line(Ffmpeg::installHint());

            return self::FAILURE;
        }

        $this->info('Ready: '.Ffmpeg::binary());

        return self::SUCCESS;
    }

    private function deleteDir(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        $items = scandir($dir);
        if ($items === false) {
            return;
        }
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $dir.'/'.$item;
            if (is_dir($path)) {
                $this->deleteDir($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
