<?php

use Illuminate\Contracts\Console\Kernel;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$root = dirname(__DIR__);

try {
    require $root.'/vendor/autoload.php';
    $app = require $root.'/bootstrap/app.php';
    $kernel = $app->make(Kernel::class);
    $status = $kernel->call('migrate', ['--force' => true]);

    echo json_encode([
        'ok' => $status === 0,
        'status' => $status,
        'output' => $kernel->output(),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
