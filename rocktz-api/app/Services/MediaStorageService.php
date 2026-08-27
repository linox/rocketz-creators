<?php

namespace App\Services;

use App\Models\MediaFile;
use App\Models\User;
use App\Support\MediaDisk;
use App\Support\MediaKind;
use App\Support\MediaUrl;
use App\Support\Mp4Faststart;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaStorageService
{
    /**
     * @return array{id: int, url: string, filename: string, path: string, size: int}
     */
    public function storeUploaded(UploadedFile $file, ?User $user): array
    {
        $kind = MediaKind::detect(
            (string) $file->getMimeType(),
            (string) $file->getClientMimeType(),
            strtolower((string) ($file->getClientOriginalExtension() ?: $file->extension())),
        );

        if ($kind === null) {
            throw new MediaStorageException(__('auth.invalid_media_type'), 422);
        }

        if ($kind === 'image' && $file->getSize() > MediaKind::MAX_IMAGE_BYTES) {
            throw new MediaStorageException(__('validation.max.file', [
                'attribute' => __('validation.attributes.file'),
                'max' => 5120,
            ]), 422);
        }

        $extension = MediaKind::safeExtension(
            strtolower((string) ($file->getClientOriginalExtension() ?: $file->extension())),
            $kind,
        );

        $source = $file->getRealPath();
        if ($source === false || ! is_file($source)) {
            throw new MediaStorageException(__('auth.upload_failed'), 500);
        }

        $temp = tempnam(sys_get_temp_dir(), 'rzmedia');
        if ($temp === false || ! copy($source, $temp)) {
            throw new MediaStorageException(__('auth.upload_failed'), 500);
        }

        return $this->storeLocalFile(
            $temp,
            $kind,
            $extension,
            MediaKind::storedMime((string) $file->getMimeType(), $kind, $extension),
            (int) $file->getSize(),
            $user,
            true,
        );
    }

    /**
     * @return array{id: int, url: string, filename: string, path: string, size: int}
     */
    public function storeAssembled(string $absolutePath, string $originalName, string $clientMime, ?User $user): array
    {
        if (! is_file($absolutePath)) {
            throw new MediaStorageException(__('auth.upload_failed'), 500);
        }

        $size = (int) filesize($absolutePath);
        $detected = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($absolutePath);
        $extension = MediaKind::rawExtension($originalName);
        $kind = MediaKind::detect($detected, $clientMime, $extension);

        if ($kind === null) {
            throw new MediaStorageException(__('auth.invalid_media_type'), 422);
        }

        if ($kind === 'image' && $size > MediaKind::MAX_IMAGE_BYTES) {
            throw new MediaStorageException(__('validation.max.file', [
                'attribute' => __('validation.attributes.file'),
                'max' => 5120,
            ]), 422);
        }

        $safeExtension = MediaKind::safeExtension($extension, $kind);

        return $this->storeLocalFile(
            $absolutePath,
            $kind,
            $safeExtension,
            MediaKind::storedMime($detected, $kind, $safeExtension),
            $size,
            $user,
            false,
        );
    }

    /**
     * @return array{folder: string, filename: string, path: string}
     */
    public function allocatePath(string $kind, string $extension): array
    {
        $folder = $kind === 'video' ? 'portfolio' : 'avatars';
        $prefix = $kind === 'video' ? 'video' : 'avatar';
        $filename = $prefix.'-'.now()->format('YmdHis').'-'.Str::lower(Str::random(8)).'.'.$extension;

        return [
            'folder' => $folder,
            'filename' => $filename,
            'path' => $folder.'/'.$filename,
        ];
    }

    /**
     * @return array{id: int, url: string, filename: string, path: string, size: int}
     */
    public function registerExisting(string $path, string $filename, string $mime, int $size, ?User $user): array
    {
        return $this->record(MediaDisk::name(), $path, $filename, $mime, $size, $user);
    }

    /**
     * @return array{id: int, url: string, filename: string, path: string, size: int}
     */
    private function storeLocalFile(
        string $absolutePath,
        string $kind,
        string $extension,
        string $mime,
        int $size,
        ?User $user,
        bool $unlink,
    ): array {
        if ($kind === 'video' && Mp4Faststart::optimize($absolutePath)) {
            $size = (int) filesize($absolutePath);
        }

        $allocated = $this->allocatePath($kind, $extension);
        $path = $allocated['path'];
        $disk = MediaDisk::name();
        $stream = fopen($absolutePath, 'rb');
        if ($stream === false) {
            if ($unlink) {
                @unlink($absolutePath);
            }
            throw new MediaStorageException(__('auth.upload_failed'), 500);
        }

        try {
            $ok = Storage::disk($disk)->writeStream($path, $stream);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
            if ($unlink) {
                @unlink($absolutePath);
            }
        }

        if (! $ok) {
            throw new MediaStorageException(__('auth.upload_failed'), 500);
        }

        return $this->record($disk, $path, $allocated['filename'], $mime, $size, $user);
    }

    /**
     * @return array{id: int, url: string, filename: string, path: string, size: int}
     */
    private function record(string $disk, string $path, string $filename, string $mime, int $size, ?User $user): array
    {
        $media = MediaFile::query()->create([
            'filename' => $filename,
            'disk' => $disk,
            'path' => $path,
            'mime_type' => $mime,
            'size' => $size,
            'uploaded_by' => $user?->id,
            'mediable_type' => $user ? $user::class : null,
            'mediable_id' => $user?->id,
        ]);

        return [
            'id' => $media->id,
            'url' => MediaUrl::playback($path),
            'filename' => $filename,
            'path' => $path,
            'size' => $size,
        ];
    }
}
