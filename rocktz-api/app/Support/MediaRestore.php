<?php

namespace App\Support;

use App\Models\MediaFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class MediaRestore
{
    /**
     * @return list<array{table: string, column: string}>
     */
    public static function urlColumns(): array
    {
        return [
            ['table' => 'campaigns', 'column' => 'image_url'],
            ['table' => 'creators', 'column' => 'photo_url'],
            ['table' => 'creators', 'column' => 'storefront_banner_url'],
            ['table' => 'companies', 'column' => 'logo_url'],
            ['table' => 'users', 'column' => 'avatar_url'],
            ['table' => 'campaign_creator_contents', 'column' => 'video_url'],
            ['table' => 'campaign_creator_contents', 'column' => 'image_url'],
            ['table' => 'campaign_creator_contents', 'column' => 'script_file_url'],
            ['table' => 'content_planning_items', 'column' => 'media_url'],
            ['table' => 'content_planning_items', 'column' => 'submission_url'],
            ['table' => 'content_planning_items', 'column' => 'script_file_url'],
            ['table' => 'content_planning_items', 'column' => 'pauta_script_file_url'],
            ['table' => 'campaign_briefings', 'column' => 'script_file_url'],
            ['table' => 'creator_portfolio_videos', 'column' => 'url'],
            ['table' => 'company_landing_pages', 'column' => 'logo_url'],
            ['table' => 'company_landing_pages', 'column' => 'banner_url'],
            ['table' => 'creator_storefront_items', 'column' => 'image_url'],
        ];
    }

    /**
     * @return list<array{table: string, column: string}>
     */
    public static function jsonColumns(): array
    {
        return [
            ['table' => 'campaign_creator_contents', 'column' => 'submission_versions'],
            ['table' => 'content_planning_items', 'column' => 'submission_versions'],
        ];
    }

    public static function rewriteStoredUrl(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }

        $rewritten = MediaUrl::publicAbsolute($url);

        return $rewritten !== null && $rewritten !== '' ? $rewritten : $url;
    }

    /**
     * @return array{copied: int, skipped: int, failed: list<string>}
     */
    public static function syncUploadsToR2(): array
    {
        $copied = 0;
        $skipped = 0;
        $failed = [];

        if (! MediaDisk::r2Configured()) {
            return compact('copied', 'skipped', 'failed');
        }

        $local = Storage::disk('uploads');
        $remote = Storage::disk('r2');

        foreach (['avatars', 'portfolio', 'documents'] as $folder) {
            foreach ($local->files($folder) as $path) {
                try {
                    if ($remote->exists($path)) {
                        $skipped++;
                        continue;
                    }

                    $stream = $local->readStream($path);
                    if ($stream === false) {
                        $failed[] = $path;
                        continue;
                    }

                    try {
                        $ok = $remote->writeStream($path, $stream);
                    } finally {
                        if (is_resource($stream)) {
                            fclose($stream);
                        }
                    }

                    if (! $ok) {
                        $failed[] = $path;
                        continue;
                    }

                    MediaFile::query()->where('path', $path)->where('disk', 'uploads')->update(['disk' => 'r2']);
                    $copied++;
                } catch (Throwable $e) {
                    $failed[] = $path.': '.$e->getMessage();
                }
            }
        }

        return compact('copied', 'skipped', 'failed');
    }

    /**
     * @return int
     */
    public static function rewriteDatabaseUrls(): int
    {
        $updated = 0;

        foreach (self::urlColumns() as $target) {
            if (! self::hasColumn($target['table'], $target['column'])) {
                continue;
            }

            $rows = DB::table($target['table'])->whereNotNull($target['column'])->get(['id', $target['column']]);
            foreach ($rows as $row) {
                $current = (string) $row->{$target['column']};
                $next = self::rewriteStoredUrl($current);
                if ($next === null || $next === $current) {
                    continue;
                }

                DB::table($target['table'])->where('id', $row->id)->update([$target['column'] => $next]);
                $updated++;
            }
        }

        foreach (self::jsonColumns() as $target) {
            if (! self::hasColumn($target['table'], $target['column'])) {
                continue;
            }

            $rows = DB::table($target['table'])->whereNotNull($target['column'])->get(['id', $target['column']]);
            foreach ($rows as $row) {
                $raw = $row->{$target['column']};
                $decoded = is_string($raw) ? json_decode($raw, true) : $raw;
                if (! is_array($decoded)) {
                    continue;
                }

                $rewritten = self::rewriteJson($decoded);
                if ($rewritten === $decoded) {
                    continue;
                }

                DB::table($target['table'])->where('id', $row->id)->update([
                    $target['column'] => json_encode($rewritten),
                ]);
                $updated++;
            }
        }

        return $updated;
    }

    /**
     * @param  array<mixed>  $value
     * @return array<mixed>
     */
    public static function rewriteJson(array $value): array
    {
        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $value[$key] = self::rewriteJson($item);
                continue;
            }

            if (! is_string($item) || $item === '') {
                continue;
            }

            $next = self::rewriteStoredUrl($item);
            if ($next !== null && $next !== $item) {
                $value[$key] = $next;
            }
        }

        return $value;
    }

    private static function hasColumn(string $table, string $column): bool
    {
        return DB::getSchemaBuilder()->hasTable($table)
            && DB::getSchemaBuilder()->hasColumn($table, $column);
    }
}
