<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        User::factory()->admin()->create([
            'name' => 'Admin Rocketz',
            'email' => 'admin@rocketz.test',
            'password' => 'password',
        ]);
    }
}
