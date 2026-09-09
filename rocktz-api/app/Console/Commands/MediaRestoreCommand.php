<?php

namespace App\Console\Commands;

use App\Support\MediaDisk;
use App\Support\MediaRestore;
use Illuminate\Console\Command;

class MediaRestoreCommand extends Command
{
    protected $signature = 'media:restore {--dry-run : List files and URLs without writing} {--skip-sync : Do not copy public/uploads to R2} {--skip-urls : Do not rewrite stored URLs}';

    protected $description = 'Copy local public/uploads files to R2 and rewrite stored /uploads and localhost URLs to /stream';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $this->line('app_url='.config('app.url'));
        $this->line('media_disk='.MediaDisk::name());
        $this->line('r2_configured='.(MediaDisk::r2Configured() ? 'yes' : 'no'));

        if (! $this->option('skip-sync')) {
            if ($dry) {
                $local = 0;
                foreach (['avatars', 'portfolio', 'documents'] as $folder) {
                    $local += count(\Illuminate\Support\Facades\Storage::disk('uploads')->files($folder));
                }
                $this->line('sync_local_files='.$local.' (dry-run)');
            } elseif (! MediaDisk::r2Configured()) {
                $this->warn('R2 is not configured; skipped copy. Files in public/uploads still play via /stream.');
            } else {
                $sync = MediaRestore::syncUploadsToR2();
                $this->line('r2_copied='.$sync['copied']);
                $this->line('r2_already_there='.$sync['skipped']);
                foreach ($sync['failed'] as $fail) {
                    $this->error('r2_failed='.$fail);
                }
            }
        }

        if (! $this->option('skip-urls')) {
            if ($dry) {
                $this->line('url_rewrite=dry-run');
            } else {
                $updated = MediaRestore::rewriteDatabaseUrls();
                $this->info($updated.' stored URL(s) rewritten to the current APP_URL stream path.');
            }
        }

        return self::SUCCESS;
    }
}
