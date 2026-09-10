<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class ScheduleTest extends TestCase
{
    public function test_cpanel_cron_drains_mail_queue_and_builds_video_previews(): void
    {
        Artisan::call('schedule:list');
        $output = Artisan::output();

        $this->assertStringContainsString('queue:work', $output);
        $this->assertStringContainsString('media:make-playable', $output);
        $this->assertStringContainsString('pending', $output);
    }
}
