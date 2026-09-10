<?php

namespace App\Console\Commands;

use App\Models\MediaFile;
use App\Support\BrowserVideo;
use App\Support\Ffmpeg;
use App\Support\MediaDisk;
use App\Support\MediaRestore;
use App\Support\MediaUrl;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class MediaMakePlayableCommand extends Command
{
    protected $signature = 'media:make-playable
        {file? : Filename, or omit to convert every .mov missing an MP4}
        {--pending : Convert all stored .mov files missing an MP4}
        {--limit=0 : Max files to convert (0 = all)}';

    /** @var list<string> */
    protected $aliases = ['media:mp4'];

    protected $description = 'Generate 720p H.264 preview MP4s beside stored .mov files without replacing the originals';

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
        } else {
            $keys = $this->pendingKeys((int) $this->option('limit'));
            if ($keys === []) {
                $this->info('No pending .mov files.');

                return self::SUCCESS;
            }
            $this->info('Pending: '.count($keys));
        }

        if (! BrowserVideo::ffmpegBinary()) {
            $this->error(Ffmpeg::installHint());

            return self::FAILURE;
        }

        set_time_limit(0);

        $ok = 0;
        $failed = 0;
        foreach ($keys as $key) {
            $this->line('converting '.$key);
            $result = BrowserVideo::ensurePlayable($key);
            if ($result === null) {
                $why = BrowserVideo::lastError();
                $this->error('failed '.$key.($why ? ' — '.$why : ''));
                $failed++;

                continue;
            }
            $this->info('playable '.$result['path']);
            $ok++;
        }

        $this->line("done: {$ok} converted, {$failed} failed");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
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
    public function pendingKeys(int $limit = 0): array
    {
        $unlimited = $limit <= 0;
        $keys = [];

        foreach ($this->candidateKeys() as $path) {
            if (! is_string($path) || $path === '' || ! BrowserVideo::needsTranscode($path) || $this->hasPreview($path)) {
                continue;
            }
            $keys[$path] = $path;
            if (! $unlimited && count($keys) >= $limit) {
                return array_values($keys);
            }
        }

        return array_values($keys);
    }

    /**
     * @return list<string>
     */
    private function candidateKeys(): array
    {
        $keys = MediaFile::query()
            ->where(function ($query) {
                $query->where('path', 'like', '%.mov')
                    ->orWhere('path', 'like', '%.MOV')
                    ->orWhere('path', 'like', '%.m4v')
                    ->orWhere('path', 'like', '%.qt');
            })
            ->pluck('path')
            ->filter()
            ->all();

        foreach ($this->keysFromStoredUrls() as $path) {
            $keys[] = $path;
        }

        foreach (['uploads', ...(MediaDisk::r2Configured() ? ['r2'] : [])] as $diskName) {
            try {
                $disk = Storage::disk($diskName);
                foreach (['portfolio', 'avatars'] as $folder) {
                    foreach ($disk->files($folder) as $path) {
                        $keys[] = $path;
                    }
                }
            } catch (Throwable) {
                //
            }
        }

        return array_values(array_unique($keys));
    }

    /**
     * @return list<string>
     */
    private function keysFromStoredUrls(): array
    {
        $keys = [];
        foreach (MediaRestore::urlColumns() as $column) {
            try {
                $values = DB::table($column['table'])->whereNotNull($column['column'])->pluck($column['column']);
            } catch (Throwable) {
                continue;
            }
            foreach ($values as $url) {
                $key = MediaUrl::objectKeyFromPublicUrl((string) $url);
                if (is_string($key) && $key !== '') {
                    $keys[] = $key;
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
        } catch (Throwable) {
            return false;
        }
    }
}
