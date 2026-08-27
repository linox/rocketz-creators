<?php

namespace App\Console\Commands;

use App\Support\MediaDisk;
use App\Support\MediaUrl;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

class MediaHealthCommand extends Command
{
    protected $signature = 'media:health';

    protected $description = 'Check whether R2 credentials and playback URLs work on this server';

    public function handle(): int
    {
        $this->line('app_url='.config('app.url'));
        $this->line('frontend_url='.(string) config('app.frontend_url'));
        $this->line('media_disk='.MediaDisk::name());
        $this->line('r2_configured='.(MediaDisk::r2Configured() ? 'yes' : 'no'));
        $this->line('r2_bucket='.(string) config('filesystems.disks.r2.bucket'));
        $this->line('r2_endpoint_host='.(string) parse_url((string) config('filesystems.disks.r2.endpoint'), PHP_URL_HOST));

        if (! MediaDisk::r2Configured()) {
            $this->error('R2 is not configured. Set MEDIA_DISK=r2 plus R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_ENDPOINT, then php artisan config:clear');

            return self::FAILURE;
        }

        try {
            $files = Storage::disk('r2')->files('portfolio');
            $this->line('r2_portfolio_objects='.count($files));
            if ($files === []) {
                $this->warn('Bucket is reachable but portfolio/ is empty.');

                return self::SUCCESS;
            }

            $path = (string) $files[array_key_last($files)];
            $size = Storage::disk('r2')->size($path);
            $signed = MediaUrl::signedGet($path);
            $this->line('r2_sample_path='.$path);
            $this->line('r2_sample_bytes='.$size);
            $this->line('r2_signed_get='.(is_string($signed) && str_starts_with($signed, 'http') ? 'ok' : 'fail'));
            $this->line('playback='.MediaUrl::playback($path));
        } catch (Throwable $e) {
            $this->error(class_basename($e).': '.$e->getMessage());

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
