<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyMultiMembershipTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_user_can_belong_to_two_companies_and_switch(): void
    {
        $user = User::factory()->company()->create();
        $first = Company::factory()->active()->create();
        $second = Company::factory()->active()->create();

        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $first->id,
        ]);
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $second->id,
        ]);

        $user->refresh();
        $this->assertSame($first->id, $user->active_company_id);

        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.company.id', $first->id)
            ->assertJsonCount(2, 'user.companies');

        $this->withToken($token)
            ->getJson('/api/companies')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->withToken($token)
            ->patchJson('/api/auth/company', ['company_id' => $second->id])
            ->assertOk()
            ->assertJsonPath('user.company.id', $second->id);

        $this->assertSame($second->id, $user->fresh()->active_company_id);

        $this->withToken($token)
            ->postJson('/api/campaigns', ['name' => 'Campanha da segunda', 'is_barter' => true])
            ->assertCreated()
            ->assertJsonPath('data.company_id', $second->id);
    }

    public function test_admin_can_link_existing_company_user_to_another_company(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->company()->create([
            'email' => 'multi@marca.test',
            'name' => 'Patrícia Multi',
        ]);
        $first = Company::factory()->active()->create();
        $second = Company::factory()->active()->create();

        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $first->id,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/companies/{$second->id}/users", [
                'name' => 'Patrícia Multi',
                'email' => 'multi@marca.test',
                'can_publish_without_approval' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('linked', true);

        $this->assertDatabaseHas('company_users', [
            'user_id' => $user->id,
            'company_id' => $second->id,
            'can_publish_without_approval' => true,
        ]);
        $this->assertSame(1, User::query()->where('email', 'multi@marca.test')->count());
    }

    public function test_deleting_one_company_keeps_user_with_another_membership(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->company()->create();
        $keep = Company::factory()->active()->create();
        $remove = Company::factory()->active()->create();

        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $keep->id,
        ]);
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $remove->id,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/companies/{$remove->id}")
            ->assertOk();

        $this->assertDatabaseHas('users', ['id' => $user->id]);
        $this->assertDatabaseHas('company_users', [
            'user_id' => $user->id,
            'company_id' => $keep->id,
        ]);
        $this->assertSame($keep->id, $user->fresh()->active_company_id);
    }

    public function test_admin_can_attach_and_detach_company_from_user_endpoint(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->company()->create();
        $first = Company::factory()->active()->create();
        $second = Company::factory()->active()->create();

        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $first->id,
        ]);

        $listed = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/users?role=company')
            ->assertOk()
            ->json('data');
        $row = collect($listed)->firstWhere('id', $user->id);
        $this->assertNotNull($row);
        $this->assertEquals([$first->id], array_column($row['companies'] ?? [], 'id'));

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/users/{$user->id}/companies", ['company_id' => $second->id])
            ->assertOk()
            ->assertJsonCount(2, 'data.companies');

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/users/{$user->id}/companies/{$second->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.companies');

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/users/{$user->id}/companies/{$first->id}")
            ->assertStatus(422);
    }
}
