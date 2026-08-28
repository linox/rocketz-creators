<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_login_is_recorded(): void
    {
        $user = User::factory()->admin()->create([
            'email' => 'logs@rocketz.test',
            'password' => 'secret123',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'logs@rocketz.test',
            'password' => 'secret123',
        ])->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'login.success',
            'category' => 'access',
            'user_id' => $user->id,
            'actor_email' => 'logs@rocketz.test',
        ]);
    }

    public function test_failed_login_is_recorded_without_password(): void
    {
        $user = User::factory()->admin()->create([
            'email' => 'logs@rocketz.test',
            'password' => 'secret123',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'logs@rocketz.test',
            'password' => 'wrong-password',
        ])->assertUnprocessable();

        $row = ActivityLog::query()->where('action', 'login.failed')->first();
        $this->assertNotNull($row);
        $this->assertSame($user->id, $row->user_id);
        $this->assertArrayNotHasKey('password', $row->properties ?? []);
    }

    public function test_logout_is_recorded(): void
    {
        $user = User::factory()->admin()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'logout',
            'user_id' => $user->id,
        ]);
    }

    public function test_mutating_request_is_recorded_and_get_is_not(): void
    {
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)->getJson('/api/users')->assertOk();
        $this->assertSame(0, ActivityLog::query()->where('category', 'action')->count());

        $this->withToken($token)
            ->postJson('/api/users', [
                'name' => 'Ops Logs',
                'email' => 'ops.logs@rocketz.test',
                'password' => 'password',
                'role' => 'admin',
                'permissions' => ['logs.view'],
            ])
            ->assertCreated();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'user.create',
            'category' => 'action',
            'user_id' => $admin->id,
        ]);
        $created = ActivityLog::query()->where('action', 'user.create')->first();
        $this->assertArrayNotHasKey('password', $created->properties ?? []);
    }

    public function test_creator_cannot_list_activity_logs(): void
    {
        $creator = User::factory()->creator()->create();

        $this->withToken($creator->createToken('auth')->plainTextToken)
            ->getJson('/api/activity-logs')
            ->assertForbidden();
    }

    public function test_admin_can_list_and_filter_activity_logs(): void
    {
        $admin = User::factory()->admin()->create();
        ActivityLog::query()->create([
            'user_id' => $admin->id,
            'actor_email' => $admin->email,
            'actor_name' => $admin->name,
            'actor_role' => 'admin',
            'category' => 'access',
            'action' => 'login.success',
            'method' => 'POST',
            'path' => 'api/auth/login',
            'status_code' => 200,
            'ip' => '127.0.0.1',
        ]);

        $response = $this->withToken($admin->createToken('auth')->plainTextToken)
            ->getJson('/api/activity-logs?category=access')
            ->assertOk()
            ->assertJsonPath('data.0.action', 'login.success');

        $this->assertArrayHasKey('today_logins', $response->json('meta'));
    }
}
