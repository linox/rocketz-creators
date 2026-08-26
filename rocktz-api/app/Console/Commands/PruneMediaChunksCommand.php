<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class PruneMediaChunksCommand extends Command
{
    protected $signature = 'media:prune-chunks';

    protected $description = 'Delete incomplete chunked media uploads older than 24 hours';

    public function handle(): int
    {
        $disk = Storage::disk('local');
        $cutoff = now()->subDay();

        foreach ($disk->directories('media-chunks') as $userDir) {
            foreach ($disk->directories($userDir) as $sessionDir) {
                $raw = $disk->exists($sessionDir.'/meta.json') ? $disk->get($sessionDir.'/meta.json') : null;
                $meta = is_string($raw) ? json_decode($raw, true) : null;
                $created = is_array($meta) && isset($meta['created_at']) ? $meta['created_at'] : null;

                $createdAt = is_string($created) ? Carbon::parse($created) : null;
                if (! $createdAt || $cutoff->greaterThan($createdAt)) {
                    $disk->deleteDirectory($sessionDir);
                }
            }
        }

        return self::SUCCESS;
    }
}
