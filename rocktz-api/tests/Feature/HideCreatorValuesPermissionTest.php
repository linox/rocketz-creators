<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HideCreatorValuesPermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_permission_hides_creator_money_and_blocks_edits(): void
    {
        $creator = Creator::factory()->active()->create([
            'pricing' => ['reel' => 1500, 'story' => 400],
        ]);
        $campaign = Campaign::factory()->create([
            'creator_cache' => 800,
            'total_budget' => 5000,
        ]);
        $participation = CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'amount' => 900,
        ]);

        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/creators/{$creator->id}")
            ->assertOk()
            ->assertJsonPath('data.pricing.reel', 1500);

        $this->withToken($token)
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertOk()
            ->assertJsonPath('data.creator_cache', 800)
            ->assertJsonPath('data.total_budget', 5000)
            ->assertJsonPath('data.applications.0.amount', 900)
            ->assertJsonPath('data.applications.0.creator.pricing.reel', 1500);

        app(PermissionService::class)->sync($admin, [
            Permission::UsersManage->value,
            Permission::CreatorsHideValues->value,
        ]);
        $admin->unsetRelation('permissionGrants');

        $this->withToken($token)
            ->getJson("/api/creators/{$creator->id}")
            ->assertOk()
            ->assertJsonPath('data.pricing', []);

        $this->withToken($token)
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertOk()
            ->assertJsonPath('data.creator_cache', null)
            ->assertJsonPath('data.creators_budget', null)
            ->assertJsonPath('data.total_budget', 5000)
            ->assertJsonPath('data.applications.0.amount', null)
            ->assertJsonPath('data.applications.0.creator.pricing', []);

        $this->withToken($token)
            ->patchJson("/api/creators/{$creator->id}", [
                'pricing' => ['reel' => 10],
                'bio' => 'Sem valores',
            ])
            ->assertOk()
            ->assertJsonPath('data.pricing', [])
            ->assertJsonPath('data.bio', 'Sem valores');

        $this->assertSame(1500, (int) $creator->fresh()->pricing['reel']);

        $this->withToken($token)
            ->patchJson("/api/campaign-creators/{$participation->id}", [
                'amount' => 10,
                'delivery_type' => 'story',
            ])
            ->assertOk()
            ->assertJsonPath('data.amount', null)
            ->assertJsonPath('data.delivery_type', 'story');

        $this->assertSame(900.0, (float) $participation->fresh()->amount);
        $this->assertSame(800.0, (float) $campaign->fresh()->creator_cache);

        $this->withToken($token)
            ->patchJson("/api/campaigns/{$campaign->id}", [
                'creator_cache' => 10,
                'name' => 'Campanha sem cachê visível',
            ])
            ->assertOk()
            ->assertJsonPath('data.creator_cache', null)
            ->assertJsonPath('data.name', 'Campanha sem cachê visível');

        $this->assertSame(800.0, (float) $campaign->fresh()->creator_cache);

        $this->actingAs($creator->user, 'sanctum')
            ->getJson("/api/creators/{$creator->id}")
            ->assertOk()
            ->assertJsonPath('data.pricing.reel', 1500);
    }

    public function test_company_user_can_receive_the_permission(): void
    {
        $company = Company::factory()->active()->create();
        $companyUser = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $companyUser->id,
            'company_id' => $company->id,
        ]);
        $creator = Creator::factory()->active()->create([
            'pricing' => ['reel' => 2200],
        ]);
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'creator_cache' => 640,
        ]);
        CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'amount' => 640,
        ]);

        app(PermissionService::class)->sync($companyUser, [Permission::CreatorsHideValues->value]);

        $this->actingAs($companyUser, 'sanctum')
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertOk()
            ->assertJsonPath('data.creator_cache', null)
            ->assertJsonPath('data.applications.0.amount', null)
            ->assertJsonPath('data.applications.0.creator.pricing', []);
    }
}
