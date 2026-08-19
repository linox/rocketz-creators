<?php

namespace Database\Factories;

use App\Models\MediaFile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MediaFile>
 */
class MediaFileFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $filename = Str::uuid()->toString().'.jpg';

        return [
            'filename' => $filename,
            'disk' => 'local',
            'path' => 'media/'.$filename,
            'mime_type' => 'image/jpeg',
            'size' => fake()->numberBetween(12_000, 850_000),
            'uploaded_by' => User::factory(),
            'mediable_type' => null,
            'mediable_id' => null,
        ];
    }
}
