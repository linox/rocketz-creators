<?php

namespace App\Services;

use App\Models\MediaFile;
use App\Models\User;
use App\Support\MediaKind;
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

        return $this->persist(
            $kind,
            $extension,
            MediaKind::storedMime((string) $file->getMimeType(), $kind, $extension),
            (int) $file->getSize(),
            $user,
            function (string $folder, string $filename) use ($file): string {
                $path = $file->storeAs($folder, $filename, 'uploads');
                if (! $path) {
                    throw new MediaStorageException(__('auth.upload_failed'), 500);
                }

                return $path;
            },
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

        return $this->persist(
            $kind,
            $safeExtension,
            MediaKind::storedMime($detected, $kind, $safeExtension),
            $size,
            $user,
            function (string $folder, string $filename) use ($absolutePath): string {
                $path = $folder.'/'.$filename;
                $stream = fopen($absolutePath, 'rb');
                if ($stream === false) {
                    throw new MediaStorageException(__('auth.upload_failed'), 500);
                }

                try {
                    $ok = Storage::disk('uploads')->writeStream($path, $stream);
                } finally {
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                }

                if (! $ok) {
                    throw new MediaStorageException(__('auth.upload_failed'), 500);
                }

                return $path;
            },
        );
    }

    /**
     * @param  callable(string, string): string  $writer
     * @return array{id: int, url: string, filename: string, path: string, size: int}
     */
    private function persist(string $kind, string $extension, string $mime, int $size, ?User $user, callable $writer): array
    {
        $folder = $kind === 'video' ? 'portfolio' : 'avatars';
        $prefix = $kind === 'video' ? 'video' : 'avatar';
        $filename = $prefix.'-'.now()->format('YmdHis').'-'.Str::lower(Str::random(8)).'.'.$extension;
        $path = $writer($folder, $filename);

        if ($kind === 'video') {
            $absolute = Storage::disk('uploads')->path($path);
            if (Mp4Faststart::optimize($absolute)) {
                $size = (int) filesize($absolute);
            }
        }

        $media = MediaFile::query()->create([
            'filename' => $filename,
            'disk' => 'uploads',
            'path' => $path,
            'mime_type' => $mime,
            'size' => $size,
            'uploaded_by' => $user?->id,
            'mediable_type' => $user ? $user::class : null,
            'mediable_id' => $user?->id,
        ]);

        return [
            'id' => $media->id,
            'url' => Storage::disk('uploads')->url($path),
            'filename' => $filename,
            'path' => $path,
            'size' => $size,
        ];
    }
}
