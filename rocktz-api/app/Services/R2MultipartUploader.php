<?php

namespace App\Services;

use App\Support\MediaUrl;
use Aws\S3\S3Client;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Facades\Storage;

class R2MultipartUploader
{
    public function create(string $key, string $contentType): string
    {
        $result = $this->client()->createMultipartUpload([
            'Bucket' => $this->bucket(),
            'Key' => $key,
            'ContentType' => $contentType,
            'CacheControl' => 'public, max-age=31536000, immutable',
        ]);

        return (string) $result['UploadId'];
    }

    /**
     * @return list<string>
     */
    public function presignedPartUrls(string $key, string $uploadId, int $totalParts): array
    {
        $client = $this->client();
        $bucket = $this->bucket();
        $expires = now()->addHours((int) config('media.r2_presign_hours', 6));
        $urls = [];

        for ($part = 1; $part <= $totalParts; $part++) {
            $command = $client->getCommand('UploadPart', [
                'Bucket' => $bucket,
                'Key' => $key,
                'UploadId' => $uploadId,
                'PartNumber' => $part,
            ]);
            $request = $client->createPresignedRequest($command, $expires);
            $urls[] = (string) $request->getUri();
        }

        return $urls;
    }

    /**
     * @param  list<array{PartNumber: int, ETag: string}>  $parts
     */
    public function complete(string $key, string $uploadId, array $parts): void
    {
        usort($parts, fn (array $a, array $b) => $a['PartNumber'] <=> $b['PartNumber']);

        $this->client()->completeMultipartUpload([
            'Bucket' => $this->bucket(),
            'Key' => $key,
            'UploadId' => $uploadId,
            'MultipartUpload' => ['Parts' => $parts],
        ]);
    }

    public function abort(string $key, string $uploadId): void
    {
        $this->client()->abortMultipartUpload([
            'Bucket' => $this->bucket(),
            'Key' => $key,
            'UploadId' => $uploadId,
        ]);
    }

    /**
     * @return list<array{PartNumber: int, ETag: string}>
     */
    public function listParts(string $key, string $uploadId): array
    {
        $parts = [];
        $token = null;

        do {
            $params = [
                'Bucket' => $this->bucket(),
                'Key' => $key,
                'UploadId' => $uploadId,
            ];
            if (is_string($token) && $token !== '') {
                $params['PartNumberMarker'] = $token;
            }

            $result = $this->client()->listParts($params);
            foreach ($result['Parts'] ?? [] as $part) {
                $etag = trim((string) ($part['ETag'] ?? ''));
                $number = (int) ($part['PartNumber'] ?? 0);
                if ($number < 1 || $etag === '') {
                    continue;
                }
                $parts[] = [
                    'PartNumber' => $number,
                    'ETag' => $etag,
                ];
            }

            $token = ! empty($result['IsTruncated'])
                ? (string) ($result['NextPartNumberMarker'] ?? '')
                : null;
        } while (is_string($token) && $token !== '');

        usort($parts, fn (array $a, array $b) => $a['PartNumber'] <=> $b['PartNumber']);

        return $parts;
    }

    public function objectSize(string $key): int
    {
        $head = $this->client()->headObject([
            'Bucket' => $this->bucket(),
            'Key' => $key,
        ]);

        return (int) $head['ContentLength'];
    }

    /**
     * @return array{status: int, type: string, length: int, range: ?string, body: mixed}
     */
    public function readObject(string $key, ?string $range = null): array
    {
        $params = [
            'Bucket' => $this->bucket(),
            'Key' => $key,
        ];
        if (is_string($range) && $range !== '') {
            $params['Range'] = $range;
        }

        $result = $this->client()->getObject($params);

        return [
            'status' => $range ? 206 : 200,
            'type' => (string) ($result['ContentType'] ?? 'application/octet-stream'),
            'length' => (int) ($result['ContentLength'] ?? 0),
            'range' => isset($result['ContentRange']) ? (string) $result['ContentRange'] : null,
            'body' => $result['Body'],
        ];
    }

    public function url(string $key): string
    {
        return MediaUrl::playback($key);
    }

    private function client(): S3Client
    {
        $disk = Storage::disk('r2');
        if (! $disk instanceof AwsS3V3Adapter) {
            throw new MediaStorageException(__('auth.upload_failed'), 500);
        }

        return $disk->getClient();
    }

    private function bucket(): string
    {
        return (string) config('filesystems.disks.r2.bucket');
    }
}
