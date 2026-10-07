<?php

namespace Tests\Feature;

use App\Enums\CreatorStatus;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreatorRegistrationRestoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_lists_rejected_creators_and_can_restore_or_approve(): void
    {
        $admin = User::factory()->admin()->create();
        $rejected = Creator::factory()->rejected()->create();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/creators?status=rejected')
            ->assertOk()
            ->assertJsonPath('data.0.id', $rejected->id)
            ->assertJsonPath('data.0.status', CreatorStatus::Rejected->value)
            ->assertJsonPath('data.0.can_restore', true)
            ->assertJsonPath('data.0.can_moderate', false);

        $this->withToken($token)
            ->postJson("/api/creators/{$rejected->id}/restore")
            ->assertOk()
            ->assertJsonPath('data.status', CreatorStatus::Review->value)
            ->assertJsonPath('data.can_restore', false)
            ->assertJsonPath('data.can_moderate', true);

        $this->assertSame(CreatorStatus::Review, $rejected->fresh()->status);

        $again = Creator::factory()->rejected()->create();

        $this->withToken($token)
            ->postJson("/api/creators/{$again->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', CreatorStatus::Active->value);

        $this->withToken($token)
            ->postJson("/api/creators/{$again->id}/restore")
            ->assertStatus(422);
    }

    public function test_company_can_restore_rejected_creator_in_its_pool(): void
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);
        $rejected = Creator::factory()->rejected()->create([
            'invited_by_company_id' => $company->id,
        ]);
        $outsider = Creator::factory()->rejected()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/creators?status=rejected')
            ->assertOk()
            ->assertJsonPath('data.0.id', $rejected->id)
            ->assertJsonCount(1, 'data');

        $this->withToken($token)
            ->postJson("/api/creators/{$outsider->id}/restore")
            ->assertForbidden();

        $this->withToken($token)
            ->postJson("/api/creators/{$rejected->id}/restore")
            ->assertOk()
            ->assertJsonPath('data.status', CreatorStatus::Review->value);
    }
}
