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
        User::query()->each(function (User $user): void {
            Consent::factory()->create([
                'user_id' => $user->id,
                'type' => ConsentType::LgpdSignup,
                'accepted_at' => now(),
            ]);
        });
    }
}
