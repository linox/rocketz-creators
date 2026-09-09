<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$root = is_dir(__DIR__.'/app') ? __DIR__ : dirname(__DIR__);
$health = $root.'/app/Http/Controllers/Api/HealthController.php';
$routes = $root.'/routes/api.php';

if (function_exists('opcache_reset')) {
    opcache_reset();
}

foreach ([$health, $routes, $root.'/bootstrap/app.php'] as $file) {
    if (is_file($file) && function_exists('opcache_invalidate')) {
        opcache_invalidate($file, true);
    }
}

echo json_encode([
    'opcache_reset' => function_exists('opcache_reset'),
    'health_on_disk' => is_file($health) && str_contains((string) file_get_contents($health), 'AppVersion'),
    'storefront_routes' => is_file($routes) && str_contains((string) file_get_contents($routes), 'storefront/settings'),
    'app_version' => is_readable($root.'/APP_VERSION') ? trim((string) file_get_contents($root.'/APP_VERSION')) : '',
]);
