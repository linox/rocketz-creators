<?php

return [
    'disk' => env('MEDIA_DISK', 'uploads'),
    'chunk_bytes' => (int) env('MEDIA_CHUNK_BYTES', 2 * 1024 * 1024),
    'r2_min_part_bytes' => (int) env('MEDIA_R2_MIN_PART_BYTES', 8 * 1024 * 1024),
    'r2_presign_hours' => (int) env('MEDIA_R2_PRESIGN_HOURS', 6),
];
