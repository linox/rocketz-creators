<?php

namespace Database\Seeders\Concerns;

use App\Enums\UserRole;
use App\Models\Creator;
use App\Models\User;
use App\Services\PermissionService;
use Database\Seeders\DemoAccounts;

trait SeedsDemoAccounts
{
    protected function ensureUser(string $email, UserRole $role, string $name): User
    {
        $user = User::query()->where('email', $email)->first();
        if ($user) {
            if ($user->role === UserRole::Admin) {
                app(PermissionService::class)->grantDefaults($user);
            }

            return $user;
        }

        $factory = match ($role) {
            UserRole::Admin => User::factory()->admin(),
            UserRole::Company => User::factory()->company(),
            UserRole::Creator => User::factory()->creator(),
        };

        return $factory->create([
            'name' => $name,
            'email' => $email,
            'password' => DemoAccounts::PASSWORD,
        ]);
    }

    protected function demoUser(string $email): User
    {
        return User::query()->where('email', $email)->firstOrFail();
    }

    protected function demoCreator(string $email): Creator
    {
        return Creator::query()
            ->whereHas('user', fn ($query) => $query->where('email', $email))
            ->firstOrFail();
    }
}
