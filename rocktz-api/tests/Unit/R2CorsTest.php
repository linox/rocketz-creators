<?php

namespace Tests\Unit;

use App\Support\R2Cors;
use Tests\TestCase;

class R2CorsTest extends TestCase
{
    public function test_it_includes_production_and_local_origins(): void
    {
        $origins = R2Cors::origins();

        $this->assertContains('https://creatorz.digital', $origins);
        $this->assertContains('http://localhost:3000', $origins);
        $this->assertContains(rtrim((string) config('app.frontend_url'), '/'), $origins);
    }
}
