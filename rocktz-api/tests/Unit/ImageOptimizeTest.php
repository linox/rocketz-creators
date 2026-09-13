<?php

namespace Tests\Unit;

use App\Support\ImageOptimize;
use Tests\TestCase;

class ImageOptimizeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (! function_exists('imagecreatetruecolor') || ! function_exists('imagejpeg')) {
            $this->markTestSkipped('GD is required to optimize images.');
        }
    }

    public function test_it_downscales_oversized_photos_and_shrinks_the_file(): void
    {
        $path = $this->writeNoisyJpeg(2400, 1600);

        try {
            $originalSize = (int) filesize($path);
            $result = ImageOptimize::process($path);

            $this->assertNotNull($result);
            $this->assertContains($result['extension'], ['webp', 'jpg']);
            $this->assertLessThan($originalSize, $result['size']);

            $info = getimagesize($path);
            $this->assertNotFalse($info);
            $this->assertLessThanOrEqual(1920, max((int) $info[0], (int) $info[1]));
        } finally {
            @unlink($path);
        }
    }

    public function test_it_keeps_animated_gifs_untouched(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'gif').'.gif';
        file_put_contents($path, $this->animatedGif());

        try {
            $before = (string) file_get_contents($path);
            $this->assertNull(ImageOptimize::process($path));
            $this->assertSame($before, (string) file_get_contents($path));
        } finally {
            @unlink($path);
        }
    }

    public function test_transparent_png_stays_an_alpha_format(): void
    {
        $path = $this->writeTransparentPng(400, 200);

        try {
            $result = ImageOptimize::process($path);
            if ($result === null) {
                $info = getimagesize($path);
                $this->assertSame('image/png', $info['mime'] ?? null);

                return;
            }

            $this->assertContains($result['extension'], ['webp', 'png']);
            $this->assertContains($result['mime'], ['image/webp', 'image/png']);
        } finally {
            @unlink($path);
        }
    }

    private function writeNoisyJpeg(int $width, int $height): string
    {
        $image = imagecreatetruecolor($width, $height);
        for ($y = 0; $y < $height; $y += 8) {
            for ($x = 0; $x < $width; $x += 8) {
                $color = imagecolorallocate($image, ($x * 13) % 255, ($y * 7) % 255, ($x + $y) % 255);
                imagefilledrectangle($image, $x, $y, $x + 7, $y + 7, $color);
            }
        }

        $path = tempnam(sys_get_temp_dir(), 'jpg').'.jpg';
        imagejpeg($image, $path, 95);
        imagedestroy($image);

        return $path;
    }

    private function writeTransparentPng(int $width, int $height): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        $transparent = imagecolorallocatealpha($image, 0, 0, 0, 127);
        imagefilledrectangle($image, 0, 0, $width, $height, $transparent);
        $red = imagecolorallocatealpha($image, 220, 40, 40, 0);
        imagefilledellipse($image, (int) ($width / 2), (int) ($height / 2), 80, 80, $red);

        $path = tempnam(sys_get_temp_dir(), 'png').'.png';
        imagepng($image, $path);
        imagedestroy($image);

        return $path;
    }

    private function animatedGif(): string
    {
        return "GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\x00\x00\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;";
    }
}
