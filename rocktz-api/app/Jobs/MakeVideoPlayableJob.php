<?php

namespace App\Jobs;

use App\Support\BrowserVideo;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class MakeVideoPlayableJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 1800;

    public function __construct(public string $key) {}

    public function handle(): void
    {
        if (! BrowserVideo::needsTranscode($this->key)) {
            return;
        }

        try {
            BrowserVideo::ensurePlayable($this->key);
        } catch (Throwable $e) {
            report($e);
        }
    }
}
