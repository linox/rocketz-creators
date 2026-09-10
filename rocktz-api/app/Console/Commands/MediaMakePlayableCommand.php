<?php

namespace App\Console\Commands;

use App\Models\MediaFile;
use App\Support\BrowserVideo;
use App\Support\Ffmpeg;
use App\Support\MediaDisk;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class MediaMakePlayableCommand extends Command
{
    protected $signature = 'media:make-playable {key? : Object key, e.g. portfolio/video.mov} {--pending : Convert stored .mov files missing an MP4} {--limit=5}';

    protected $description = 'Transcode QuickTime videos on R2 to H.264 MP4 so the browser player can play them';

    public function handle(): int
    {
        if (! MediaDisk::r2Configured()) {
            $this->error('R2 is not configured.');

            return self::FAILURE;
        }
        if (! BrowserVideo::ffmpegBinary()) {
            $this->error(Ffmpeg::installHint());

            return self::FAILURE;
        }

        $keys = [];
        $requested = (string) $this->argument('key');
        if ($requested !== '') {
            $keys[] = ltrim($requested, '/');
        } elseif ($this->option('pending')) {
            $keys = MediaFile::query()
                ->where(function ($query) {
                    $query->where('path', 'like', '%.mov')
                        ->orWhere('path', 'like', '%.MOV');
                })
                ->limit((int) $this->option('limit'))
                ->pluck('path')
                ->filter()
                ->unique()
                ->values()
                ->all();

            if ($keys === []) {
                $disk = Storage::disk('r2');
                foreach ($disk->files('portfolio') as $path) {
                    if (BrowserVideo::needsTranscode($path) && ! $disk->exists(BrowserVideo::mp4Key($path))) {
                        $keys[] = $path;
                        if (count($keys) >= (int) $this->option('limit')) {
                            break;
                        }
                    }
                }
            }
        } else {
            $this->error('Pass a key or --pending.');

            return self::FAILURE;
        }

        $ok = 0;
        foreach ($keys as $key) {
            $this->line('converting '.$key);
            $result = BrowserVideo::ensureRemotePlayable($key);
            if ($result === null) {
                $this->error('failed '.$key);
                continue;
            }
            $this->info('playable '.$result['path']);
            $ok++;
        }

        return $ok > 0 || $keys === [] ? self::SUCCESS : self::FAILURE;
    }
}
