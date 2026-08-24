<?php

namespace Database\Seeders;

use App\Enums\ConsentType;
use App\Models\Consent;
use App\Models\User;
use Illuminate\Database\Seeder;

class ConsentSeeder extends Seeder
{
    public function run(): void
    {
        $demoEmails = array_column(DemoAccounts::loginTable(), 'email');

        User::query()->whereIn('email', $demoEmails)->each(function (User $user): void {
            if (Consent::query()->where('user_id', $user->id)->where('type', ConsentType::LgpdSignup)->exists()) {
                return;
            }

            Consent::factory()->create([
                'user_id' => $user->id,
                'type' => ConsentType::LgpdSignup,
                'accepted_at' => now(),
            ]);
        });
    }
}
