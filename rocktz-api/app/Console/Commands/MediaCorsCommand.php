<?php

namespace App\Console\Commands;

use App\Support\MediaDisk;
use App\Support\R2Client;
use App\Support\R2Cors;
use Illuminate\Console\Command;
use Throwable;

class MediaCorsCommand extends Command
{
    protected $signature = 'media:cors';

    protected $description = 'Set R2 bucket CORS so the browser can PUT videos from the app origins';

    public function handle(): int
    {
        if (! MediaDisk::r2Configured()) {
            $this->error('R2 is not configured.');

            return self::FAILURE;
        }

        $origins = R2Cors::origins();
        foreach ($origins as $origin) {
            $this->line('origin='.$origin);
        }

        try {
            R2Cors::apply();
            $result = R2Client::make()->getBucketCors([
                'Bucket' => (string) config('filesystems.disks.r2.bucket'),
            ]);
        } catch (Throwable $e) {
            $this->error(class_basename($e).': '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info('R2 CORS updated.');
        foreach ($result['CORSRules'] ?? [] as $rule) {
            $this->line('allowed_origins='.implode(',', $rule['AllowedOrigins'] ?? []));
            $this->line('allowed_methods='.implode(',', $rule['AllowedMethods'] ?? []));
            $this->line('expose_headers='.implode(',', $rule['ExposeHeaders'] ?? []));
        }

        return self::SUCCESS;
    }
}
