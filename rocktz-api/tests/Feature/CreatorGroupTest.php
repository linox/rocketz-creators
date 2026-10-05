<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\CreatorGroup;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreatorGroupTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_manages_groups_and_only_pool_creators_can_join(): void
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);
        $member = Creator::factory()->active()->create([
            'invited_by_company_id' => $company->id,
        ]);
        $outsider = Creator::factory()->active()->create();

        $created = $this->asUser($user)
            ->postJson('/api/creator-groups', [
                'name' => 'Micro beleza',
                'description' => 'Beleza até 100 mil',
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Micro beleza')
            ->assertJsonPath('data.company_id', $company->id);

        $groupId = (int) $created->json('data.id');

        $this->asUser($user)
            ->postJson("/api/creator-groups/{$groupId}/members", ['creator_id' => $member->id])
            ->assertOk()
            ->assertJsonPath('data.members_count', 1);

        $this->asUser($user)
            ->postJson("/api/creator-groups/{$groupId}/members", ['creator_id' => $outsider->id])
            ->assertStatus(422);

        $other = User::factory()->company()->create();
        $otherCompany = Company::factory()->active()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $other->id,
            'company_id' => $otherCompany->id,
        ]);
        $this->asUser($other)
            ->patchJson("/api/creator-groups/{$groupId}", ['name' => 'Invadido'])
            ->assertForbidden();
    }

    public function test_campaign_can_target_a_group_and_a_network_size(): void
    {
        $campaign = Campaign::factory()->create([
            'is_barter' => true,
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'min_followers' => 10001,
            'max_followers' => 100000,
        ]);
        $group = CreatorGroup::factory()->create([
            'company_id' => $campaign->company_id,
            'name' => 'Micro beleza',
        ]);
        $campaign->creatorGroups()->attach($group->id);

        $inside = $this->applicant([
            'invited_by_company_id' => $campaign->company_id,
            'metrics' => ['instagram_followers' => 40000, 'tiktok_followers' => 8000],
        ]);
        $wrongSize = $this->applicant([
            'invited_by_company_id' => $campaign->company_id,
            'metrics' => ['instagram_followers' => 5000, 'tiktok_followers' => 250000],
        ]);
        $outside = $this->applicant([
            'metrics' => ['instagram_followers' => 40000],
        ]);
        $group->creators()->attach($inside->id);
        $group->creators()->attach($wrongSize->id);

        $this->assertTrue($this->seesCampaign($inside, $campaign));
        $this->assertFalse($this->seesCampaign($wrongSize, $campaign));
        $this->assertFalse($this->seesCampaign($outside, $campaign));

        $this->asUser($outside->user)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_group_restricted'));

        $this->asUser($wrongSize->user)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_network_restricted'));

        $admin = User::factory()->admin()->create();
        $otherGroup = CreatorGroup::factory()->create();
        $this->asUser($admin)
            ->patchJson("/api/campaigns/{$campaign->id}", [
                'creator_group_ids' => [$otherGroup->id],
            ])
            ->assertStatus(422);

        $this->asUser($inside->user)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero'])
            ->assertCreated();
    }

    private function seesCampaign(Creator $creator, Campaign $campaign): bool
    {
        $available = $this->asUser($creator->user)
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');

        return collect($available)->contains(fn ($row) => (int) $row['id'] === $campaign->id);
    }

    private function asUser(User $user): static
    {
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('auth')->plainTextToken);
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    private function applicant(array $attrs = []): Creator
    {
        $creator = Creator::factory()->active()->create([
            'country' => 'BR',
            ...$attrs,
        ]);
        CreatorContractAcceptance::factory()->valid()->create([
            'creator_id' => $creator->id,
            'full_name' => $creator->full_name,
            'email' => $creator->user?->email,
        ]);

        return $creator->load('user');
    }
}
