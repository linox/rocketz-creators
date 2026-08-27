<?php

namespace App\Jobs;

use App\Services\MediaStorageException;
use App\Services\MediaStorageService;
use App\Services\MediaSubmissionService;
use App\Support\MediaUploadStatus;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Storage;
use Throwable;

class FinalizeMediaUploadJob
{
    use Dispatchable;

    public function __construct(
        public int $userId,
        public string $uploadId,
    ) {}

    public function handle(
        MediaStorageService $media,
        MediaSubmissionService $submissions,
    ): void {
        MediaUploadStatus::put($this->uploadId, MediaUploadStatus::PROCESSING, ['progress' => 92]);
        $submissions->updateLinkedProgress($this->uploadId, 92);

        $disk = Storage::disk('local');
        $metaPath = 'media-chunks/'.$this->userId.'/'.$this->uploadId.'/meta.json';

        if (! $disk->exists($metaPath)) {
            $this->failUpload(__('auth.upload_session_invalid'));

            return;
        }

        $meta = json_decode((string) $disk->get($metaPath), true);
        if (! is_array($meta) || (int) ($meta['user_id'] ?? 0) !== $this->userId) {
            $this->failUpload(__('auth.upload_session_invalid'));

            return;
        }

        $sessionDir = 'media-chunks/'.$this->userId.'/'.$this->uploadId;
        $totalChunks = (int) ($meta['total_chunks'] ?? 0);

        try {
            $assembledRelative = $sessionDir.'/assembled';
            $assembledAbsolute = $disk->path($assembledRelative);
            $disk->makeDirectory($sessionDir);
            $out = fopen($assembledAbsolute, 'wb');
            if ($out === false) {
                throw new MediaStorageException(__('auth.upload_failed'), 500);
            }

            try {
                for ($index = 0; $index < $totalChunks; $index++) {
                    $chunkPath = $disk->path($sessionDir.'/'.$index);
                    $in = fopen($chunkPath, 'rb');
                    if ($in === false) {
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

            MediaUploadStatus::put($this->uploadId, MediaUploadStatus::PROCESSING, ['progress' => 96]);
            $submissions->updateLinkedProgress($this->uploadId, 96);

            $user = \App\Models\User::query()->find($this->userId);
            $payload = $media->storeAssembled(
                $assembledAbsolute,
                (string) $meta['filename'],
                (string) ($meta['mime_type'] ?? ''),
                $user,
            );

            $submission = is_array($meta['submission'] ?? null) ? $meta['submission'] : null;
            if ($submission) {
                $submissions->applySubmission($submission, $payload);
            }

            $disk->deleteDirectory($sessionDir);

            MediaUploadStatus::put($this->uploadId, MediaUploadStatus::DONE, [
                'progress' => 100,
                'data' => $payload,
            ]);
            $submissions->updateLinkedProgress($this->uploadId, 100);
            $submissions->clearPending($this->uploadId);
        } catch (MediaStorageException $e) {
            $this->failUpload($e->getMessage());
        } catch (Throwable $e) {
            report($e);
            $this->failUpload($e->getMessage() ?: __('auth.upload_failed'));
        }
    }

    private function failUpload(string $message): void
    {
        app(MediaSubmissionService::class)->clearPending($this->uploadId);
        Storage::disk('local')->deleteDirectory('media-chunks/'.$this->userId.'/'.$this->uploadId);
        MediaUploadStatus::put($this->uploadId, MediaUploadStatus::FAILED, [
            'progress' => 0,
            'message' => $message,
        ]);
    }
}
