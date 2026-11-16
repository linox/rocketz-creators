<?php

namespace App\Console\Commands;

use App\Support\BrowserVideo;
use App\Support\Ffmpeg;
use Illuminate\Console\Command;

class MediaMakePosterCommand extends Command
{
    protected $signature = 'media:make-poster {file : Object key of the video}';

    protected $description = 'Store one JPEG cover beside a video so every screen can reuse it';

    public function handle(): int
    {
        $key = ltrim(str_replace('\\', '/', trim((string) $this->argument('file'))), '/');
        if ($key === '') {
            $this->error('Missing file.');

            return self::FAILURE;
        }

        if (! BrowserVideo::ffmpegBinary()) {
            $this->error(Ffmpeg::installHint());

            return self::FAILURE;
        }

        if (! BrowserVideo::holdPoster($key)) {
            $this->line('already running '.$key);

            return self::SUCCESS;
        }

        try {
            if (BrowserVideo::posterReady($key)) {
                $this->info('cover ready '.BrowserVideo::posterKey($key));

                return self::SUCCESS;
            }

            $this->line('cover '.$key);
            if (! BrowserVideo::ensurePoster($key)) {
                $why = BrowserVideo::lastError();
                BrowserVideo::markPosterFailed($key);
                $this->error('failed '.$key.($why ? ' — '.$why : ''));

                return self::FAILURE;
            }

            $this->info('cover ready '.BrowserVideo::posterKey($key));

            return self::SUCCESS;
        } finally {
            BrowserVideo::releasePoster($key);
        }
    }
}
