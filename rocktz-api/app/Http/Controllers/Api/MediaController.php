<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MediaStorageException;
use App\Services\MediaStorageService;
use App\Support\MediaKind;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class MediaController extends Controller
{
    public function __construct(private readonly MediaStorageService $media)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:524288'],
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('file');

        try {
            return $this->respondStored($this->media->storeUploaded($file, $request->user()));
        } catch (MediaStorageException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }
    }

    public function initUpload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'filename' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:'.MediaKind::MAX_VIDEO_BYTES],
            'mime_type' => ['nullable', 'string', 'max:127'],
        ]);

        $extension = MediaKind::rawExtension($data['filename']);
        $kind = MediaKind::detect('', (string) ($data['mime_type'] ?? ''), $extension);
        if ($kind === null) {
            return response()->json(['message' => __('auth.invalid_media_type')], 422);
        }

        if ($kind === 'image' && (int) $data['size'] > MediaKind::MAX_IMAGE_BYTES) {
            return response()->json(['message' => __('validation.max.file', [
                'attribute' => __('validation.attributes.file'),
                'max' => 5120,
            ])], 422);
        }

        $uploadId = (string) Str::uuid();
        $size = (int) $data['size'];
        $chunkSize = MediaKind::chunkBytes();
        $totalChunks = (int) ceil($size / $chunkSize);
        $userId = (int) $request->user()->id;

        Storage::disk('local')->put($this->metaPath($userId, $uploadId), json_encode([
            'user_id' => $userId,
            'filename' => $data['filename'],
            'size' => $size,
            'mime_type' => (string) ($data['mime_type'] ?? ''),
            'chunk_size' => $chunkSize,
            'total_chunks' => $totalChunks,
            'created_at' => now()->toIso8601String(),
        ], JSON_THROW_ON_ERROR));

        return response()->json([
            'data' => [
                'id' => $uploadId,
                'chunk_size' => $chunkSize,
                'total_chunks' => $totalChunks,
            ],
        ], 201);
    }

    public function storeChunk(Request $request, string $uploadId, int $index): JsonResponse
    {
        $meta = $this->loadMeta($request, $uploadId);
        if ($meta === null) {
            return response()->json(['message' => __('auth.upload_session_invalid')], 404);
        }

        $totalChunks = (int) $meta['total_chunks'];
        $chunkSize = (int) $meta['chunk_size'];
        if ($index < 0 || $index >= $totalChunks) {
            return response()->json(['message' => __('auth.upload_chunk_invalid')], 422);
        }

        $bytes = $request->getContent();
        $expected = $index === $totalChunks - 1
            ? (int) $meta['size'] - ($index * $chunkSize)
            : $chunkSize;

        if ($expected < 1 || strlen($bytes) !== $expected) {
            return response()->json(['message' => __('auth.upload_chunk_invalid')], 422);
        }

        Storage::disk('local')->put($this->chunkPath((int) $meta['user_id'], $uploadId, $index), $bytes);

        return response()->json(['data' => ['index' => $index]]);
    }

    public function completeUpload(Request $request, string $uploadId): JsonResponse
    {
        $meta = $this->loadMeta($request, $uploadId);
        if ($meta === null) {
            return response()->json(['message' => __('auth.upload_session_invalid')], 404);
        }

        $userId = (int) $meta['user_id'];
        $totalChunks = (int) $meta['total_chunks'];
        $disk = Storage::disk('local');

        for ($index = 0; $index < $totalChunks; $index++) {
            if (! $disk->exists($this->chunkPath($userId, $uploadId, $index))) {
                return response()->json(['message' => __('auth.upload_incomplete')], 422);
            }
        }

        $assembledRelative = $this->sessionDir($userId, $uploadId).'/assembled';
        $assembledAbsolute = $disk->path($assembledRelative);
        $disk->makeDirectory($this->sessionDir($userId, $uploadId));
        $out = fopen($assembledAbsolute, 'wb');
        if ($out === false) {
            return response()->json(['message' => __('auth.upload_failed')], 500);
        }

        try {
            for ($index = 0; $index < $totalChunks; $index++) {
                $in = fopen($disk->path($this->chunkPath($userId, $uploadId, $index)), 'rb');
                if ($in === false) {
                    fclose($out);
                    return response()->json(['message' => __('auth.upload_failed')], 500);
                }
                stream_copy_to_stream($in, $out);
                fclose($in);
            }
        } finally {
            if (is_resource($out)) {
                fclose($out);
            }
        }

        if ((int) filesize($assembledAbsolute) !== (int) $meta['size']) {
            $disk->deleteDirectory($this->sessionDir($userId, $uploadId));

            return response()->json(['message' => __('auth.upload_failed')], 500);
        }

        try {
            $payload = $this->media->storeAssembled(
                $assembledAbsolute,
                (string) $meta['filename'],
                (string) $meta['mime_type'],
                $request->user(),
            );
        } catch (MediaStorageException $e) {
            $disk->deleteDirectory($this->sessionDir($userId, $uploadId));

            return response()->json(['message' => $e->getMessage()], $e->status);
        } catch (Throwable $e) {
            $disk->deleteDirectory($this->sessionDir($userId, $uploadId));

            return response()->json(['message' => __('auth.upload_failed')], 500);
        }

        $disk->deleteDirectory($this->sessionDir($userId, $uploadId));

        return $this->respondStored($payload);
    }

    public function download(string $folder, string $filename): StreamedResponse
    {
        abort_unless($folder === 'portfolio', 404);
        abort_unless((bool) preg_match('/^[A-Za-z0-9._-]+$/', $filename), 404);

        $path = $folder.'/'.$filename;
        abort_unless(Storage::disk('uploads')->exists($path), 404);

        return Storage::disk('uploads')->download($path, $filename);
    }

    /**
     * @param  array{id: int, url: string, filename: string, path: string, size: int}  $payload
     */
    private function respondStored(array $payload): JsonResponse
    {
        return response()->json(['data' => $payload], 201);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadMeta(Request $request, string $uploadId): ?array
    {
        if (! preg_match('/^[0-9a-fA-F-]{36}$/', $uploadId)) {
            return null;
        }

        $userId = (int) $request->user()->id;
        $path = $this->metaPath($userId, $uploadId);
        if (! Storage::disk('local')->exists($path)) {
            return null;
        }

        $meta = json_decode((string) Storage::disk('local')->get($path), true);
        if (! is_array($meta) || (int) ($meta['user_id'] ?? 0) !== $userId) {
            return null;
        }

        return $meta;
    }

    private function sessionDir(int $userId, string $uploadId): string
    {
        return 'media-chunks/'.$userId.'/'.$uploadId;
    }

    private function metaPath(int $userId, string $uploadId): string
    {
        return $this->sessionDir($userId, $uploadId).'/meta.json';
    }

    private function chunkPath(int $userId, string $uploadId, int $index): string
    {
        return $this->sessionDir($userId, $uploadId).'/'.$index;
    }
}
