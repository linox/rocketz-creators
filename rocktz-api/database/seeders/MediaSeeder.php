<?php

namespace Database\Seeders;

use App\Models\Creator;
use App\Models\MediaFile;
use Database\Seeders\Concerns\SeedsDemoAccounts;
use Illuminate\Database\Seeder;

class MediaSeeder extends Seeder
{
    use SeedsDemoAccounts;

    public function run(): void
    {
        $admin = $this->demoUser(DemoAccounts::ADMIN);
        $anaUser = $this->demoUser(DemoAccounts::CREATOR_ANA);
        $ana = $anaUser->creator()->firstOrFail();

        if (! MediaFile::query()->where('path', 'media/aurora-logo.jpg')->exists()) {
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
        }

        if (! MediaFile::query()->where('path', 'media/ana-portfolio-skincare.mp4')->exists()) {
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
}
