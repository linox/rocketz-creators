<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use Database\Seeders\Concerns\SeedsDemoAccounts;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    use SeedsDemoAccounts;

    public function run(): void
    {
        $this->ensureUser(DemoAccounts::ADMIN, UserRole::Admin, 'Admin Rocketz');
    }
}
