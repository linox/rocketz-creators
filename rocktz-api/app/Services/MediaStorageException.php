<?php

namespace App\Services;

use RuntimeException;

class MediaStorageException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status)
    {
        parent::__construct($message, $status);
    }
}
