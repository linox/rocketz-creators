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

    protected $description = 'Generate a 720p H.264 preview MP4 beside stored .mov files without replacing the original';

    public function handle(): int
    {
        if (! BrowserVideo::ffmpegBinary()) {
            $this->error(Ffmpeg::installHint());

            return self::FAILURE;
        }

        $keys = [];
        $requested = (string) $this->argument('key');
        if ($requested !== '') {
            $keys[] = ltrim($requested, '/');
        } elseif ($this->option('pending')) {
            $limit = (int) $this->option('limit');
            $candidates = MediaFile::query()
                ->where(function ($query) {
                    $query->where('path', 'like', '%.mov')
                        ->orWhere('path', 'like', '%.MOV')
                        ->orWhere('path', 'like', '%.m4v')
                        ->orWhere('path', 'like', '%.qt');
                })
                ->limit(max($limit * 5, $limit))
                ->pluck('path')
                ->filter()
                ->unique()
                ->values()
                ->all();

            foreach ($candidates as $path) {
                if (! BrowserVideo::needsTranscode($path) || $this->hasPreview($path)) {
                    continue;
                }
                $keys[] = $path;
                if (count($keys) >= $limit) {
                    break;
                }
            }

            if ($keys === [] && MediaDisk::r2Configured()) {
                $disk = Storage::disk('r2');
                foreach ($disk->files('portfolio') as $path) {
                    if (BrowserVideo::needsTranscode($path) && ! $disk->exists(BrowserVideo::mp4Key($path))) {
                        $keys[] = $path;
                        if (count($keys) >= $limit) {
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
            $result = BrowserVideo::ensurePlayable($key);
            if ($result === null) {
                $this->error('failed '.$key);

                continue;
            }
            $this->info('playable '.$result['path']);
            $ok++;
        }

        return $ok > 0 || $keys === [] ? self::SUCCESS : self::FAILURE;
    }

    private function hasPreview(string $path): bool
    {
        $mp4 = BrowserVideo::mp4Key($path);
        if ($mp4 === $path) {
            return true;
        }
        if (Storage::disk('uploads')->exists($mp4)) {
            return true;
        }

        return MediaDisk::r2Configured() && Storage::disk('r2')->exists($mp4);
    }
}
