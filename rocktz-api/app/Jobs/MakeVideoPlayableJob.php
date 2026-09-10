<?php

namespace App\Jobs;

use App\Support\BrowserVideo;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class MakeVideoPlayableJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 1800;

    public int $uniqueFor = 1800;

    public function __construct(public string $key)
    {
        $this->onQueue('media');
    }

    public function uniqueId(): string
    {
        return $this->key;
    }

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
