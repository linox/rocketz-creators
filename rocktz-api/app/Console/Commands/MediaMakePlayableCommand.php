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
    protected $signature = 'media:make-playable
        {file? : Filename or object key, e.g. video-xxx.mov}
        {--pending : Convert stored .mov files missing an MP4}
        {--limit=5}';

    /** @var list<string> */
    protected $aliases = ['media:mp4'];

    protected $description = 'Generate a 720p H.264 preview MP4 beside a stored .mov without replacing the original';

    public function handle(): int
    {
        $keys = [];
        $requested = (string) $this->argument('file');
        if ($requested !== '') {
            $key = $this->resolveKey($requested);
            if ($key === null) {
                $this->error('File not found: '.$requested);

                return self::FAILURE;
            }
            $keys[] = $key;
        } elseif ($this->option('pending')) {
            $keys = $this->pendingKeys((int) $this->option('limit'));
        } else {
            $this->error('Pass a file name, e.g. php artisan media:mp4 video-20260909181647-p5nv4ebq.mov');

            return self::FAILURE;
        }

        if (! BrowserVideo::ffmpegBinary()) {
            $this->error(Ffmpeg::installHint());

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

    public function resolveKey(string $file): ?string
    {
        $file = ltrim(str_replace('\\', '/', trim($file)), '/');
        if ($file === '') {
            return null;
        }

        if (str_contains($file, '/') && $this->objectExists($file)) {
            return $file;
        }

        $basename = basename($file);
        $fromDb = MediaFile::query()
            ->where('filename', $basename)
            ->orWhere('path', $file)
            ->orWhere('path', 'like', '%/'.$basename)
            ->value('path');
        if (is_string($fromDb) && $fromDb !== '') {
            return $fromDb;
        }

        foreach (['portfolio/'.$basename, 'avatars/'.$basename] as $candidate) {
            if ($this->objectExists($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function pendingKeys(int $limit): array
    {
        $keys = [];
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
                return $keys;
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

        return $keys;
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

    private function objectExists(string $path): bool
    {
        if (Storage::disk('uploads')->exists($path)) {
            return true;
        }
        if (! MediaDisk::r2Configured()) {
            return false;
        }

        try {
            return Storage::disk('r2')->exists($path);
        } catch (\Throwable) {
            return false;
        }
    }
}
