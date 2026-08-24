<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Demo/test data used locally and in production QA.
     * Idempotent: safe to re-run. Does not wipe existing rows.
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
            MailTemplateSeeder::class,
        ]);
    }
}
