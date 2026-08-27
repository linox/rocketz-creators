<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\FinalizeMediaUploadJob;
use App\Services\MediaStorageException;
use App\Services\MediaStorageService;
use App\Services\MediaSubmissionService;
use App\Support\MediaKind;
use App\Support\MediaUploadStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class MediaController extends Controller
{
    public function __construct(
        private readonly MediaStorageService $media,
        private readonly MediaSubmissionService $submissions,
    ) {}

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:'.(MediaKind::MAX_VIDEO_BYTES / 1024)],
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
            'submission' => ['nullable', 'array'],
            'submission.type' => ['required_with:submission', 'string', 'in:campaign_creator,content_planning_item'],
            'submission.id' => ['required_with:submission', 'integer', 'min:1'],
            'submission.payload' => ['required_with:submission', 'array'],
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
        $submission = isset($data['submission']) && is_array($data['submission']) ? $data['submission'] : null;

        if ($submission) {
            $this->submissions->beginSubmission($request->user(), $uploadId, $submission);
        }

        $meta = [
            'user_id' => $userId,
            'filename' => $data['filename'],
            'size' => $size,
            'mime_type' => (string) ($data['mime_type'] ?? ''),
            'chunk_size' => $chunkSize,
            'total_chunks' => $totalChunks,
            'created_at' => now()->toIso8601String(),
        ];

        if ($submission) {
            $meta['submission'] = $submission;
        }

        Storage::disk('local')->put($this->metaPath($userId, $uploadId), json_encode($meta, JSON_THROW_ON_ERROR));

        MediaUploadStatus::put($uploadId, MediaUploadStatus::UPLOADING, ['progress' => 0]);

        return response()->json([
            'data' => [
                'id' => $uploadId,
                'chunk_size' => $chunkSize,
                'total_chunks' => $totalChunks,
                'async' => $submission !== null,
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

        $expected = $index === $totalChunks - 1
            ? (int) $meta['size'] - ($index * $chunkSize)
            : $chunkSize;

        if ($expected < 1) {
            return response()->json(['message' => __('auth.upload_chunk_invalid')], 422);
        }

        $userId = (int) $meta['user_id'];
        $chunkPath = $this->chunkPath($userId, $uploadId, $index);
        $bytes = $request->getContent();

        if (strlen($bytes) !== $expected) {
            return response()->json(['message' => __('auth.upload_chunk_invalid')], 422);
        }

        Storage::disk('local')->put($chunkPath, $bytes);

        $received = 0;
        for ($chunkIndex = 0; $chunkIndex < $totalChunks; $chunkIndex++) {
            $path = $this->chunkPath($userId, $uploadId, $chunkIndex);
            if (Storage::disk('local')->exists($path)) {
                $received += $chunkIndex === $totalChunks - 1
                    ? (int) $meta['size'] - ($chunkIndex * $chunkSize)
                    : $chunkSize;
            }
        }

        $progress = (int) floor(($received / (int) $meta['size']) * 90);
        MediaUploadStatus::put($uploadId, MediaUploadStatus::UPLOADING, ['progress' => $progress]);
        $this->submissions->updateLinkedProgress($uploadId, $progress);

        return response()->json(['data' => ['index' => $index]]);
    }

    public function uploadStatus(Request $request, string $uploadId): JsonResponse
    {
        $meta = $this->loadMeta($request, $uploadId);
        if ($meta === null) {
            $state = MediaUploadStatus::get($uploadId);
            if ($state === null) {
                return response()->json(['message' => __('auth.upload_session_invalid')], 404);
            }

            return response()->json(['data' => $state]);
        }

        $state = MediaUploadStatus::get($uploadId) ?? ['status' => MediaUploadStatus::UPLOADING, 'progress' => 0];

        return response()->json(['data' => $state]);
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

        $hasSubmission = is_array($meta['submission'] ?? null);

        if ($hasSubmission) {
            MediaUploadStatus::put($uploadId, MediaUploadStatus::PROCESSING, ['progress' => 90]);
            $this->submissions->updateLinkedProgress($uploadId, 90);

            $job = new FinalizeMediaUploadJob($userId, $uploadId);
            if (app()->runningUnitTests()) {
                dispatch_sync($job);
            } else {
                app()->terminating(function () use ($job) {
                    if (function_exists('fastcgi_finish_request')) {
                        fastcgi_finish_request();
                    }
                    ignore_user_abort(true);
                    set_time_limit(600);
                    try {
                        app()->call([$job, 'handle']);
                    } catch (Throwable $e) {
                        report($e);
                    }
                });
            }

            $state = MediaUploadStatus::get($uploadId) ?? ['status' => MediaUploadStatus::PROCESSING, 'progress' => 90];
            $statusCode = ($state['status'] ?? null) === MediaUploadStatus::DONE ? 201 : 202;

            return response()->json(['data' => $state], $statusCode);
        }

        try {
            $payload = $this->assembleAndStore($meta, $uploadId, $request->user());
        } catch (MediaStorageException $e) {
            $disk->deleteDirectory($this->sessionDir($userId, $uploadId));

            return response()->json(['message' => $e->getMessage()], $e->status);
        } catch (Throwable $e) {
            $disk->deleteDirectory($this->sessionDir($userId, $uploadId));

            return response()->json(['message' => __('auth.upload_failed')], 500);
        }

        $disk->deleteDirectory($this->sessionDir($userId, $uploadId));
        MediaUploadStatus::put($uploadId, MediaUploadStatus::DONE, ['progress' => 100, 'data' => $payload]);

        return $this->respondStored($payload);
    }

    public function cancelUpload(Request $request, string $uploadId): JsonResponse
    {
        $meta = $this->loadMeta($request, $uploadId);
        if ($meta === null) {
            if (! $this->submissions->userOwnsPendingUpload($request->user(), $uploadId)) {
                return response()->json(['message' => __('auth.upload_session_invalid')], 404);
            }

            $this->submissions->clearPending($uploadId);
            MediaUploadStatus::put($uploadId, MediaUploadStatus::FAILED, [
                'progress' => 0,
                'message' => __('auth.upload_cancelled'),
            ]);

            return response()->json(['message' => __('auth.upload_cancelled')]);
        }

        $userId = (int) $meta['user_id'];
        Storage::disk('local')->deleteDirectory($this->sessionDir($userId, $uploadId));
        $this->submissions->clearPending($uploadId);
        MediaUploadStatus::put($uploadId, MediaUploadStatus::FAILED, [
            'progress' => 0,
            'message' => __('auth.upload_cancelled'),
        ]);

        return response()->json(['message' => __('auth.upload_cancelled')]);
    }

    public function download(string $folder, string $filename): StreamedResponse
    {
        abort_unless($folder === 'portfolio', 404);
        abort_unless((bool) preg_match('/^[A-Za-z0-9._-]+$/', $filename), 404);

        $path = $folder.'/'.$filename;
        abort_unless(Storage::disk('uploads')->exists($path), 404);

        return Storage::disk('uploads')->download($path, $filename);
    }

    public function stream(string $folder, string $filename): BinaryFileResponse
    {
        abort_unless(in_array($folder, ['portfolio', 'avatars'], true), 404);
        abort_unless((bool) preg_match('/^[A-Za-z0-9._-]+$/', $filename), 404);

        $path = $folder.'/'.$filename;
        abort_unless(Storage::disk('uploads')->exists($path), 404);

        $absolute = Storage::disk('uploads')->path($path);
        $extension = strtolower((string) pathinfo($filename, PATHINFO_EXTENSION));
        $mime = match ($extension) {
            'webm' => 'video/webm',
            'mov', 'm4v', 'mp4', 'qt' => 'video/mp4',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'jpg', 'jpeg' => 'image/jpeg',
            default => (string) (new \finfo(FILEINFO_MIME_TYPE))->file($absolute) ?: 'application/octet-stream',
        };

        return response()->file($absolute, [
            'Content-Type' => $mime,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'Cross-Origin-Resource-Policy' => 'cross-origin',
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Expose-Headers' => 'Content-Length, Content-Range, Accept-Ranges',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array{id: int, url: string, filename: string, path: string, size: int}
     */
    private function assembleAndStore(array $meta, string $uploadId, ?\App\Models\User $user): array
    {
        $userId = (int) $meta['user_id'];
        $totalChunks = (int) $meta['total_chunks'];
        $disk = Storage::disk('local');
        $sessionDir = $this->sessionDir($userId, $uploadId);
        $assembledRelative = $sessionDir.'/assembled';
        $assembledAbsolute = $disk->path($assembledRelative);
        $disk->makeDirectory($sessionDir);
        $out = fopen($assembledAbsolute, 'wb');
        if ($out === false) {
            throw new MediaStorageException(__('auth.upload_failed'), 500);
        }

        try {
            for ($index = 0; $index < $totalChunks; $index++) {
                $in = fopen($disk->path($this->chunkPath($userId, $uploadId, $index)), 'rb');
                if ($in === false) {
                    fclose($out);
                    throw new MediaStorageException(__('auth.upload_failed'), 500);
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
            throw new MediaStorageException(__('auth.upload_failed'), 500);
        }

        return $this->media->storeAssembled(
            $assembledAbsolute,
            (string) $meta['filename'],
            (string) ($meta['mime_type'] ?? ''),
            $user,
        );
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
