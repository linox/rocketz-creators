<?php

namespace Tests\Unit;

use App\Support\StorageError;
use RuntimeException;
use Tests\TestCase;

class StorageErrorTest extends TestCase
{
    public function test_it_explains_r2_unauthorized(): void
    {
        $this->assertSame(
            __('auth.r2_unauthorized'),
            StorageError::message(new RuntimeException('Unauthorized: Unauthorized')),
        );
    }

    public function test_it_explains_r2_access_denied(): void
    {
        $this->assertSame(
            __('auth.r2_access_denied'),
            StorageError::message(new RuntimeException('AccessDenied: Access Denied')),
        );
    }

    public function test_it_falls_back_when_message_is_empty(): void
    {
        $this->assertSame(
            __('auth.upload_failed'),
            StorageError::message(new RuntimeException('')),
        );
    }

    public function test_it_keeps_unrelated_storage_errors(): void
    {
        $this->assertSame(
            'NoSuchBucket: The specified bucket does not exist',
            StorageError::message(new RuntimeException('NoSuchBucket: The specified bucket does not exist')),
        );
    }
}
