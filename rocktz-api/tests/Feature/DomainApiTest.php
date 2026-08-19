<?php

namespace Tests\Feature;

use App\Enums\CreatorStatus;
use App\Models\Creator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DomainApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_load_dashboard_and_lists(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('total_creators', 4);

        $this->withToken($token)->getJson('/api/creators')->assertOk()
            ->assertJsonCount(4, 'data');

        $this->withToken($token)->getJson('/api/companies')->assertOk()
            ->assertJsonCount(2, 'data');

        $this->withToken($token)->getJson('/api/campaigns')->assertOk();
        $this->withToken($token)->getJson('/api/campaigns/available')->assertOk();
        $this->withToken($token)->getJson('/api/notifications')->assertOk();
        $this->withToken($token)->getJson('/api/recurring-contracts')->assertOk();
        $this->withToken($token)->getJson('/api/admin-users')->assertOk();
    }

    public function test_admin_can_approve_creator(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;
        $bruno = Creator::query()->where('status', CreatorStatus::Review)->first();

        $this->withToken($token)
            ->postJson("/api/creators/{$bruno->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');
    }

    public function test_creator_cannot_list_all_creators(): void
    {
        $this->seed();

        $creator = User::query()->where('email', 'ana.creator@rocketz.test')->first();
        $token = $creator->createToken('auth')->plainTextToken;

        $this->withToken($token)->getJson('/api/creators')->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_company_can_create_campaign_without_sending_company_id(): void
    {
        $this->seed();

        $company = User::query()->where('email', 'empresa@rocketz.test')->first();
        $token = $company->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/campaigns', ['name' => 'Campanha Aurora'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Campanha Aurora');
    }

    public function test_active_creator_can_apply_to_available_campaign(): void
    {
        $this->seed();

        $creator = User::query()->where('email', 'ana.creator@rocketz.test')->first();
        $token = $creator->createToken('auth')->plainTextToken;

        $campaigns = $this->withToken($token)->getJson('/api/campaigns/available')->assertOk();
        $id = $campaigns->json('data.0.id');
        $this->assertNotEmpty($id);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$id}/apply", ['notes' => 'Quero participar'])
            ->assertCreated();
    }

    public function test_admin_can_create_creator_from_casting_form(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/creators', [
                'full_name' => 'Juliana Fit',
                'artistic_name' => 'juliana.fit',
                'email' => 'juliana.fit@rocketz.test',
                'category' => 'Fitness',
            ])
            ->assertCreated()
            ->assertJsonPath('data.artistic_name', 'juliana.fit')
            ->assertJsonPath('data.status', 'review')
            ->assertJsonPath('data.role', 'creator');
    }

    public function test_admin_can_update_creator_password(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;
        $creator = Creator::query()->first();

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/password", ['password' => 'nova-senha'])
            ->assertOk();
    }
}
