<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaController extends Controller
{
    /** @var list<string> */
    private const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'qt'];

    /** @var list<string> */
    private const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:2097152'],
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $kind = $this->mediaKind($file);

        if ($kind === null) {
            return response()->json(['message' => __('auth.invalid_media_type')], 422);
        }

        if ($kind === 'image' && $file->getSize() > 5 * 1024 * 1024) {
            return response()->json(['message' => __('validation.max.file', ['attribute' => __('validation.attributes.file'), 'max' => 5120])], 422);
        }

        $folder = $kind === 'video' ? 'portfolio' : 'avatars';
        $prefix = $kind === 'video' ? 'video' : 'avatar';
        $extension = $this->safeExtension($file, $kind);
        $filename = $prefix.'-'.now()->format('YmdHis').'-'.Str::lower(Str::random(8)).'.'.$extension;
        $path = $file->storeAs($folder, $filename, 'uploads');

        if (! $path) {
            return response()->json(['message' => __('auth.upload_failed')], 500);
        }

        $media = MediaFile::query()->create([
            'filename' => $filename,
            'disk' => 'uploads',
            'path' => $path,
            'mime_type' => $this->storedMime($file, $kind, $extension),
            'size' => $file->getSize(),
            'uploaded_by' => $request->user()?->id,
            'mediable_type' => $request->user() ? $request->user()::class : null,
            'mediable_id' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => [
                'id' => $media->id,
                'url' => Storage::disk('uploads')->url($path),
                'filename' => $filename,
                'path' => $path,
                'size' => $file->getSize(),
            ],
        ], 201);
    }

    public function download(string $folder, string $filename): StreamedResponse
    {
        abort_unless($folder === 'portfolio', 404);
        abort_unless((bool) preg_match('/^[A-Za-z0-9._-]+$/', $filename), 404);

        $path = $folder.'/'.$filename;
        abort_unless(Storage::disk('uploads')->exists($path), 404);

        return Storage::disk('uploads')->download($path, $filename);
    }

    private function mediaKind(UploadedFile $file): ?string
    {
        $detected = strtolower((string) $file->getMimeType());
        $client = strtolower((string) $file->getClientMimeType());
        $extension = $this->rawExtension($file);

        if (str_starts_with($detected, 'video/') || str_starts_with($client, 'video/') || in_array($extension, self::VIDEO_EXTENSIONS, true)) {
            return 'video';
        }

        if (str_starts_with($detected, 'image/') || str_starts_with($client, 'image/') || in_array($extension, self::IMAGE_EXTENSIONS, true)) {
            return 'image';
        }

        return null;
    }

    private function rawExtension(UploadedFile $file): string
    {
        return strtolower((string) ($file->getClientOriginalExtension() ?: $file->extension()));
    }

    private function safeExtension(UploadedFile $file, string $kind): string
    {
        $extension = $this->rawExtension($file);
        $allowed = $kind === 'video' ? self::VIDEO_EXTENSIONS : self::IMAGE_EXTENSIONS;

        if (in_array($extension, $allowed, true)) {
            return $extension === 'qt' ? 'mov' : $extension;
        }

        return $kind === 'video' ? 'mp4' : 'jpg';
    }

    private function storedMime(UploadedFile $file, string $kind, string $extension): string
    {
        $mime = (string) $file->getMimeType();
        if (str_starts_with($mime, 'video/') || str_starts_with($mime, 'image/')) {
            return $mime;
        }

        return match ($extension) {
            'webm' => 'video/webm',
            'mov' => 'video/quicktime',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            default => $kind === 'video' ? 'video/mp4' : 'image/jpeg',
        };
    }
}
