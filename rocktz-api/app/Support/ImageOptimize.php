<?php

namespace App\Support;

use GdImage;

class ImageOptimize
{
    public const MAX_EDGE = 1920;

    public const MAX_PIXELS = 40_000_000;

    public const JPEG_QUALITY = 85;

    public const WEBP_QUALITY = 82;

    /**
     * Re-encode and downscale an image in place. Returns the stored format when
     * the rewritten file is smaller (or was resized); otherwise leaves the
     * original untouched.
     *
     * @return array{extension: string, mime: string, size: int}|null
     */
    public static function process(string $path): ?array
    {
        if (! is_file($path) || ! function_exists('imagecreatefromstring')) {
            return null;
        }

        $originalSize = (int) filesize($path);
        if ($originalSize < 32) {
            return null;
        }

        $bytes = file_get_contents($path);
        if ($bytes === false || $bytes === '') {
            return null;
        }

        if (self::isAnimatedGif($bytes)) {
            return null;
        }

        $info = @getimagesizefromstring($bytes);
        if ($info === false || ($info[0] ?? 0) < 1 || ($info[1] ?? 0) < 1) {
            return null;
        }

        $width = (int) $info[0];
        $height = (int) $info[1];
        if (($width * $height) > self::MAX_PIXELS) {
            return null;
        }

        $source = @imagecreatefromstring($bytes);
        if (! $source instanceof GdImage) {
            return null;
        }

        $source = self::orient($source, $path);
        $source = self::fit($source, self::maxEdge());
        if (! $source instanceof GdImage) {
            return null;
        }

        $resized = imagesx($source) !== $width || imagesy($source) !== $height;
        $hasAlpha = self::preservesAlpha((string) ($info['mime'] ?? ''));
        $encoded = self::bestEncoding($source, $hasAlpha);
        imagedestroy($source);

        if ($encoded === null) {
            return null;
        }

        $newSize = strlen($encoded['bytes']);
        if ($newSize < 32) {
            return null;
        }

        if ($newSize >= $originalSize && ! $resized) {
            return null;
        }

        $temp = $path.'.opt';
        if (file_put_contents($temp, $encoded['bytes']) === false) {
            @unlink($temp);

            return null;
        }

        if (! rename($temp, $path)) {
            @unlink($temp);

            return null;
        }

        return [
            'extension' => $encoded['extension'],
            'mime' => $encoded['mime'],
            'size' => $newSize,
        ];
    }

    private static function maxEdge(): int
    {
        $edge = (int) config('media.image_max_edge', self::MAX_EDGE);

        return $edge > 0 ? $edge : self::MAX_EDGE;
    }

    private static function jpegQuality(): int
    {
        $quality = (int) config('media.image_jpeg_quality', self::JPEG_QUALITY);

        return max(60, min(95, $quality > 0 ? $quality : self::JPEG_QUALITY));
    }

    private static function webpQuality(): int
    {
        $quality = (int) config('media.image_webp_quality', self::WEBP_QUALITY);

        return max(60, min(95, $quality > 0 ? $quality : self::WEBP_QUALITY));
    }

    private static function fit(GdImage $source, int $maxEdge): GdImage
    {
        $width = imagesx($source);
        $height = imagesy($source);
        if ($width <= $maxEdge && $height <= $maxEdge) {
            return $source;
        }

        $scale = min($maxEdge / $width, $maxEdge / $height);
        $newWidth = max(1, (int) round($width * $scale));
        $newHeight = max(1, (int) round($height * $scale));
        $resized = imagecreatetruecolor($newWidth, $newHeight);
        if ($resized === false) {
            return $source;
        }

        imagealphablending($resized, false);
        imagesavealpha($resized, true);
        $transparent = imagecolorallocatealpha($resized, 0, 0, 0, 127);
        imagefilledrectangle($resized, 0, 0, $newWidth, $newHeight, $transparent);
        imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagedestroy($source);

        return $resized;
    }

    private static function orient(GdImage $image, string $path): GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data($path);
        $orientation = (int) ($exif['Orientation'] ?? 1);
        if ($orientation < 2 || $orientation > 8) {
            return $image;
        }

        $background = imagecolorallocatealpha($image, 0, 0, 0, 127) ?: 0;

        $oriented = match ($orientation) {
            2 => self::flipped($image, IMG_FLIP_HORIZONTAL),
            3 => imagerotate($image, 180, $background),
            4 => self::flipped($image, IMG_FLIP_VERTICAL),
            5 => self::rotatedThenFlipped($image, 270, $background, IMG_FLIP_HORIZONTAL),
            6 => imagerotate($image, 270, $background),
            7 => self::rotatedThenFlipped($image, 90, $background, IMG_FLIP_HORIZONTAL),
            8 => imagerotate($image, 90, $background),
            default => $image,
        };

        if ($oriented instanceof GdImage && $oriented !== $image) {
            imagedestroy($image);

            return $oriented;
        }

        return $image;
    }

    private static function flipped(GdImage $image, int $mode): GdImage
    {
        imageflip($image, $mode);

        return $image;
    }

    private static function rotatedThenFlipped(GdImage $image, int $angle, int $background, int $mode): GdImage|false
    {
        $rotated = imagerotate($image, $angle, $background);
        if (! $rotated instanceof GdImage) {
            return false;
        }

        imageflip($rotated, $mode);

        return $rotated;
    }

    private static function preservesAlpha(string $mime): bool
    {
        return in_array(strtolower($mime), ['image/png', 'image/webp', 'image/gif'], true);
    }

    /**
     * @return array{extension: string, mime: string, bytes: string}|null
     */
    private static function bestEncoding(GdImage $image, bool $hasAlpha): ?array
    {
        $candidates = [];

        if (function_exists('imagewebp')) {
            $candidates[] = self::encode($image, 'webp', $hasAlpha);
        }

        $candidates[] = $hasAlpha
            ? self::encode($image, 'png', true)
            : self::encode($image, 'jpg', false);

        $best = null;
        foreach ($candidates as $candidate) {
            if ($candidate === null) {
                continue;
            }
            if ($best === null || strlen($candidate['bytes']) < strlen($best['bytes'])) {
                $best = $candidate;
            }
        }

        return $best;
    }

    /**
     * @return array{extension: string, mime: string, bytes: string}|null
     */
    private static function encode(GdImage $image, string $format, bool $hasAlpha): ?array
    {
        ob_start();
        $ok = match ($format) {
            'webp' => imagewebp($image, null, $hasAlpha && defined('IMG_WEBP_LOSSLESS')
                ? IMG_WEBP_LOSSLESS
                : ($hasAlpha ? 90 : self::webpQuality())),
            'png' => self::encodePng($image),
            default => self::encodeJpeg($image),
        };
        $bytes = (string) ob_get_clean();
        if (! $ok || $bytes === '') {
            return null;
        }

        return match ($format) {
            'webp' => ['extension' => 'webp', 'mime' => 'image/webp', 'bytes' => $bytes],
            'png' => ['extension' => 'png', 'mime' => 'image/png', 'bytes' => $bytes],
            default => ['extension' => 'jpg', 'mime' => 'image/jpeg', 'bytes' => $bytes],
        };
    }

    private static function encodePng(GdImage $image): bool
    {
        imagesavealpha($image, true);

        return imagepng($image, null, 6);
    }

    private static function encodeJpeg(GdImage $image): bool
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $canvas = imagecreatetruecolor($width, $height);
        if ($canvas === false) {
            return imagejpeg($image, null, self::jpegQuality());
        }

        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefilledrectangle($canvas, 0, 0, $width, $height, $white);
        imagecopy($canvas, $image, 0, 0, 0, 0, $width, $height);
        imageinterlace($canvas, true);
        $ok = imagejpeg($canvas, null, self::jpegQuality());
        imagedestroy($canvas);

        return $ok;
    }

    private static function isAnimatedGif(string $bytes): bool
    {
        if (! str_starts_with($bytes, 'GIF8')) {
            return false;
        }

        return preg_match_all('/\x00\x21\xF9\x04/', $bytes) > 1;
    }
}
