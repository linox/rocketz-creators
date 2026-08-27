<?php

$frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'stream/*', 'downloads/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter([
        $frontend,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://creatorz.digital',
        'https://www.creatorz.digital',
    ]))),

    'allowed_origins_patterns' => env('APP_ENV') === 'local' ? [
        '#^https?://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        '#^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        '#^https?://172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$#',
    ] : [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag'],

    'max_age' => 3600,

    'supports_credentials' => false,

];
