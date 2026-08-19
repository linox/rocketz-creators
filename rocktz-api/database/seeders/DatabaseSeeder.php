<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            AdminSeeder::class,
            CreatorSeeder::class,
            CompanySeeder::class,
            CampaignSeeder::class,
            RecurringSeeder::class,
            NotificationSeeder::class,
            ConsentSeeder::class,
            MediaSeeder::class,
        ]);
    }
}
