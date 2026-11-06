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
        $this->assertStringContainsString("--queue='high,default'", $output);
        $this->assertStringContainsString("--queue='mail'", $output);
        $this->assertStringContainsString('--max-jobs=30', $output);
        $this->assertStringContainsString('--max-time=40', $output);
        $this->assertStringContainsString('media:make-playable', $output);
        $this->assertStringContainsString('pending', $output);
    }
}
