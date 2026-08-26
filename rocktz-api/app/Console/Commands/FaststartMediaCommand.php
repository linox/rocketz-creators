<?php

namespace App\Console\Commands;

use App\Support\Mp4Faststart;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class FaststartMediaCommand extends Command
{
    protected $signature = 'media:faststart';

    protected $description = 'Rewrite existing MP4/MOV uploads so the player can start without downloading the whole file';

    public function handle(): int
    {
        $disk = Storage::disk('uploads');
        $rewritten = 0;

        foreach ($disk->files('portfolio') as $path) {
            $absolute = $disk->path($path);
            if (Mp4Faststart::optimize($absolute)) {
                $this->line($path);
                $rewritten++;
            }
        }

        $this->info($rewritten.' file(s) optimized.');

        return self::SUCCESS;
    }
}
