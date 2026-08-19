<?php

namespace Database\Seeders;

use App\Models\Creator;
use App\Models\MediaFile;
use App\Models\User;
use Illuminate\Database\Seeder;

class MediaSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $anaUser = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $ana = $anaUser->creator()->firstOrFail();

        MediaFile::factory()->create([
            'filename' => 'aurora-logo.jpg',
            'disk' => 'local',
            'path' => 'media/aurora-logo.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 48200,
            'uploaded_by' => $admin->id,
            'mediable_type' => null,
            'mediable_id' => null,
        ]);

        MediaFile::factory()->create([
            'filename' => 'ana-portfolio-skincare.mp4',
            'disk' => 'local',
            'path' => 'media/ana-portfolio-skincare.mp4',
            'mime_type' => 'video/mp4',
            'size' => 1_250_000,
            'uploaded_by' => $anaUser->id,
            'mediable_type' => Creator::class,
            'mediable_id' => $ana->id,
        ]);
    }
}
