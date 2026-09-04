<?php
/**
 * Injeta title/Open Graph da landing da empresa no HTML estático.
 * WhatsApp e crawlers não executam JS; o Apache reescreve /l/{slug}/ para este script.
 */
declare(strict_types=1);

$slug = strtolower((string) ($_GET['slug'] ?? ''));
$slug = preg_replace('/[^a-z0-9-]/', '', $slug) ?? '';
$slug = substr($slug, 0, 64);

$htmlFile = __DIR__ . '/l/_/index.html';
$html = is_file($htmlFile) ? (string) file_get_contents($htmlFile) : '';
if ($html === '') {
    http_response_code(404);
    echo 'Not found';
    exit;
}

$api = rtrim('__API_URL__', '/');
$seo = $slug !== '' ? fetch_landing_seo($api, $slug) : null;
if (is_array($seo)) {
    $html = inject_landing_seo($html, $seo);
}

header('Content-Type: text/html; charset=UTF-8');
echo $html;

/**
 * @return array{title?: string, description?: string, image?: ?string, url?: string}|null
 */
function fetch_landing_seo(string $api, string $slug): ?array
{
    $url = $api . '/landings/' . rawurlencode($slug);
    $body = http_get($url);
    if ($body === null) {
        return null;
    }
    $decoded = json_decode($body, true);
    if (! is_array($decoded) || ! isset($decoded['data']['seo']) || ! is_array($decoded['data']['seo'])) {
        return null;
    }

    return $decoded['data']['seo'];
}

function http_get(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch === false) {
            return null;
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 4,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (! is_string($body) || $status !== 200) {
            return null;
        }

        return $body;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "Accept: application/json\r\n",
            'timeout' => 4,
            'ignore_errors' => true,
        ],
    ]);
    $body = @file_get_contents($url, false, $context);

    return is_string($body) ? $body : null;
}

/**
 * @param array{title?: string, description?: string, image?: ?string, url?: string} $seo
 */
function inject_landing_seo(string $html, array $seo): string
{
    $title = e((string) ($seo['title'] ?? ''));
    $description = e((string) ($seo['description'] ?? ''));
    $url = e((string) ($seo['url'] ?? ''));
    $image = e((string) ($seo['image'] ?? ''));
    if ($title === '') {
        return $html;
    }

    $html = preg_replace('/<title>.*?<\/title>/is', '<title>' . $title . '</title>', $html, 1) ?? $html;

    if (preg_match('/<meta\s+name=["\']description["\'][^>]*>/i', $html)) {
        $html = preg_replace(
            '/<meta\s+name=["\']description["\'][^>]*>/i',
            '<meta name="description" content="' . $description . '" />',
            $html,
            1,
        ) ?? $html;
    } else {
        $html = str_replace('</head>', '<meta name="description" content="' . $description . '" />' . "\n</head>", $html);
    }

    $tags = [
        '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="Creatorz by Rocketz" />',
        '<meta property="og:title" content="' . $title . '" />',
        '<meta property="og:description" content="' . $description . '" />',
        '<meta name="twitter:card" content="' . ($image !== '' ? 'summary_large_image' : 'summary') . '" />',
        '<meta name="twitter:title" content="' . $title . '" />',
        '<meta name="twitter:description" content="' . $description . '" />',
    ];
    if ($url !== '') {
        $tags[] = '<link rel="canonical" href="' . $url . '" />';
        $tags[] = '<meta property="og:url" content="' . $url . '" />';
    }
    if ($image !== '') {
        $tags[] = '<meta property="og:image" content="' . $image . '" />';
        $tags[] = '<meta property="og:image:alt" content="' . $title . '" />';
        $tags[] = '<meta name="twitter:image" content="' . $image . '" />';
    }

    $ld = [
        '@context' => 'https://schema.org',
        '@type' => 'WebPage',
        'name' => html_entity_decode($title, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'description' => html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'url' => html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
    ];
    if ($image !== '') {
        $ld['image'] = html_entity_decode($image, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    $tags[] = '<script type="application/ld+json">' . json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>';

    return str_replace('</head>', implode("\n", $tags) . "\n</head>", $html);
}

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
