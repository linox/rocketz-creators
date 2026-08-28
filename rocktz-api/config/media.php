<?php

return [
    'disk' => env('MEDIA_DISK', 'uploads'),
    'chunk_bytes' => (int) env('MEDIA_CHUNK_BYTES', 2 * 1024 * 1024),
    'r2_min_part_bytes' => (int) env('MEDIA_R2_MIN_PART_BYTES', 8 * 1024 * 1024),
    'r2_presign_hours' => (int) env('MEDIA_R2_PRESIGN_HOURS', 6),
    'r2_cors_origins' => env('R2_CORS_ORIGINS', 'https://creatorz.digital,https://www.creatorz.digital,http://localhost:3000,http://127.0.0.1:3000'),
];
