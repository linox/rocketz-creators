<?php

return [
    'disk' => env('MEDIA_DISK', 'uploads'),
    'chunk_bytes' => (int) env('MEDIA_CHUNK_BYTES', 2 * 1024 * 1024),
    'r2_min_part_bytes' => (int) env('MEDIA_R2_MIN_PART_BYTES', 8 * 1024 * 1024),
    'r2_presign_hours' => (int) env('MEDIA_R2_PRESIGN_HOURS', 6),
    'r2_cors_origins' => env('R2_CORS_ORIGINS', 'https://creatorz.digital,https://www.creatorz.digital,http://localhost:3000,http://127.0.0.1:3000'),
    'ffmpeg_path' => env('FFMPEG_PATH', ''),
    'ffprobe_path' => env('FFPROBE_PATH', ''),
    'image_max_edge' => (int) env('MEDIA_IMAGE_MAX_EDGE', 1920),
    'image_jpeg_quality' => (int) env('MEDIA_IMAGE_JPEG_QUALITY', 85),
    'image_webp_quality' => (int) env('MEDIA_IMAGE_WEBP_QUALITY', 82),
];
