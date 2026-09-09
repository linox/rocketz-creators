<?php

namespace Tests\Unit;

use App\Models\Campaign;
use App\Models\Company;
use App\Support\MediaRestore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaRestoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_rewrites_localhost_uploads_to_current_stream_url(): void
    {
        config(['app.url' => 'https://api.creatorz.digital']);

        $campaign = Campaign::factory()->create([
            'image_url' => 'http://localhost:8000/uploads/avatars/avatar-old.png',
        ]);
        Company::factory()->active()->create([
            'logo_url' => 'https://placehold.co/200x200?text=Logo',
        ]);

        $updated = MediaRestore::rewriteDatabaseUrls();

        $this->assertSame(1, $updated);
        $this->assertSame(
            'https://api.creatorz.digital/stream/avatars/avatar-old.png',
            $campaign->fresh()->image_url,
        );
    }

    public function test_sync_skips_files_already_on_r2(): void
    {
        Storage::fake('uploads');
        Storage::fake('r2');
        config([
            'media.disk' => 'r2',
            'filesystems.disks.r2.key' => 'key',
            'filesystems.disks.r2.secret' => 'secret',
            'filesystems.disks.r2.bucket' => 'creatorz',
            'filesystems.disks.r2.endpoint' => 'https://example.r2.cloudflarestorage.com',
        ]);

        Storage::disk('uploads')->put('avatars/old.png', 'png');
        Storage::disk('r2')->put('avatars/old.png', 'png');
        Storage::disk('uploads')->put('avatars/new.png', 'png');

        $result = MediaRestore::syncUploadsToR2();

        $this->assertSame(1, $result['copied']);
        $this->assertSame(1, $result['skipped']);
        $this->assertTrue(Storage::disk('r2')->exists('avatars/new.png'));
    }
}
