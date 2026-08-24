<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Company;
use App\Models\Creator;
use App\Models\Notification;
use App\Models\RecurringContract;
use App\Models\User;
use Database\Seeders\DemoAccounts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoSeedTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seed_is_idempotent(): void
    {
        $this->seed();

        $counts = [
            'users' => User::query()->count(),
            'creators' => Creator::query()->count(),
            'companies' => Company::query()->count(),
            'campaigns' => Campaign::query()->count(),
            'recurring' => RecurringContract::query()->count(),
            'notifications' => Notification::query()->count(),
        ];

        $this->seed();

        $this->assertSame($counts['users'], User::query()->count());
        $this->assertSame($counts['creators'], Creator::query()->count());
        $this->assertSame($counts['companies'], Company::query()->count());
        $this->assertSame($counts['campaigns'], Campaign::query()->count());
        $this->assertSame($counts['recurring'], RecurringContract::query()->count());
        $this->assertSame($counts['notifications'], Notification::query()->count());
        $this->assertSame(7, $counts['users']);
        $this->assertSame(4, $counts['creators']);
        $this->assertSame(2, $counts['companies']);
        $this->assertNotNull(User::query()->where('email', DemoAccounts::ADMIN)->first());
        $this->assertTrue(User::query()->where('email', DemoAccounts::ADMIN)->first()->hasPermission('mail.manage'));
    }
}
