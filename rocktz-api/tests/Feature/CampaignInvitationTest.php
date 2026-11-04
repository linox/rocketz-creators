<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Enums\MailTemplateKey;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\MailMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignInvitationTest extends TestCase
{
    use RefreshDatabase;

    public function test_secret_campaign_invites_instead_of_adding_the_creator(): void
    {
        $campaign = $this->secretCampaign(['max_approved_creators' => 1]);
        $creator = $this->applicant();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/assign", [
                'creator_id' => $creator->id,
                'invite' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.application_status', ApplicationStatus::Invited->value);

        $this->assertSame(CampaignStatus::Briefing, $campaign->refresh()->status);
        $this->assertSame(1, MailMessage::query()
            ->where('template_key', MailTemplateKey::CampaignInvitation)
            ->where('creator_id', $creator->id)
            ->count());
        $this->assertDatabaseHas('notifications', [
            'creator_id' => $creator->id,
            'campaign_id' => $campaign->id,
            'title' => __('auth.campaign_invited_title'),
        ]);
    }

    public function test_public_assign_still_approves_immediately(): void
    {
        $campaign = Campaign::factory()->create([
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
        ]);
        $creator = $this->applicant();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/assign", [
                'creator_id' => $creator->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.application_status', ApplicationStatus::Approved->value);
    }

    public function test_secret_campaign_can_add_a_creator_without_an_invitation(): void
    {
        $campaign = $this->secretCampaign();
        $creator = $this->applicant();
        $other = $this->applicant();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/assign", [
                'creator_id' => $creator->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.application_status', ApplicationStatus::Approved->value);

        $this->assertSame(0, MailMessage::query()
            ->where('template_key', MailTemplateKey::CampaignInvitation)
            ->where('creator_id', $creator->id)
            ->count());

        $this->actingAs($creator->user, 'sanctum')
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertOk()
            ->assertJsonPath('data.applications.0.application_status', ApplicationStatus::Approved->value);

        $listed = $this->actingAs($creator->user, 'sanctum')
            ->getJson('/api/campaigns')
            ->assertOk()
            ->json('data');
        $this->assertTrue(collect($listed)->contains(fn ($row) => (int) $row['id'] === $campaign->id));

        $this->actingAs($other->user, 'sanctum')
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertForbidden();
    }

    public function test_only_the_invited_creator_sees_the_secret_campaign_and_can_answer(): void
    {
        $campaign = $this->secretCampaign();
        $invited = $this->applicant();
        $other = $this->applicant();
        $admin = User::factory()->admin()->create();
        $companyUser = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $companyUser->id,
            'company_id' => $campaign->company_id,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/assign", [
                'creator_id' => $invited->id,
                'invite' => true,
            ])
            ->assertCreated();

        $hidden = $this->actingAs($other->user, 'sanctum')
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');
        $this->assertFalse(collect($hidden)->contains(fn ($row) => (int) $row['id'] === $campaign->id));
        $this->actingAs($other->user, 'sanctum')
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertForbidden();
        $this->actingAs($other->user, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/invitation", ['decision' => 'accept'])
            ->assertForbidden();

        $visible = $this->actingAs($invited->user, 'sanctum')
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');
        $listed = collect($visible)->firstWhere('id', $campaign->id);
        $this->assertNotNull($listed);
        $this->assertTrue($listed['is_secret']);
        $this->assertSame(ApplicationStatus::Invited->value, $listed['applications'][0]['application_status']);

        $this->actingAs($invited->user, 'sanctum')
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertOk()
            ->assertJsonPath('data.is_secret', true);

        $this->actingAs($invited->user, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden();

        $this->actingAs($invited->user, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/invitation", ['decision' => 'accept'])
            ->assertOk()
            ->assertJsonPath('data.application_status', ApplicationStatus::Approved->value);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $companyUser->id,
            'title' => __('auth.campaign_invite_accepted_title'),
        ]);

        $afterAccept = $this->actingAs($invited->user, 'sanctum')
            ->getJson('/api/campaigns')
            ->assertOk()
            ->json('data');
        $this->assertTrue(collect($afterAccept)->contains(fn ($row) => (int) $row['id'] === $campaign->id));
    }

    public function test_invited_creator_can_decline_and_be_invited_again(): void
    {
        $campaign = $this->secretCampaign();
        $creator = $this->applicant();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/assign", ['creator_id' => $creator->id, 'invite' => true])
            ->assertCreated();

        $this->actingAs($creator->user, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/invitation", ['decision' => 'decline'])
            ->assertOk()
            ->assertJsonPath('data.application_status', ApplicationStatus::Declined->value);

        $visible = $this->actingAs($creator->user, 'sanctum')
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');
        $this->assertTrue(collect($visible)->contains(fn ($row) => (int) $row['id'] === $campaign->id));

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/assign", ['creator_id' => $creator->id, 'invite' => true])
            ->assertCreated()
            ->assertJsonPath('data.application_status', ApplicationStatus::Invited->value);

        $this->assertSame(2, MailMessage::query()
            ->where('template_key', MailTemplateKey::CampaignInvitation)
            ->where('creator_id', $creator->id)
            ->count());
    }

    public function test_accepting_the_last_seat_closes_the_secret_campaign(): void
    {
        $campaign = $this->secretCampaign(['max_approved_creators' => 1]);
        $first = $this->applicant();
        $second = $this->applicant();
        $admin = User::factory()->admin()->create();

        CampaignCreator::factory()->invited()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $first->id,
        ]);
        CampaignCreator::factory()->invited()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $second->id,
        ]);

        $this->actingAs($first->user, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/invitation", ['decision' => 'accept'])
            ->assertOk();

        $this->assertSame(CampaignStatus::Finished, $campaign->refresh()->status);

        $this->actingAs($second->user, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/invitation", ['decision' => 'accept'])
            ->assertStatus(422)
            ->assertJsonPath('message', __('auth.campaign_approved_limit_full'));

        $this->assertSame(
            ApplicationStatus::Invited,
            CampaignCreator::query()->where('creator_id', $second->id)->firstOrFail()->application_status,
        );
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    private function secretCampaign(array $attrs = []): Campaign
    {
        return Campaign::factory()->create(array_merge([
            'is_secret' => true,
            'is_barter' => true,
            'status' => CampaignStatus::Briefing,
            'total_budget' => 0,
            'creators_budget' => 0,
            'creator_cache' => 0,
        ], $attrs));
    }

    private function applicant(): Creator
    {
        $creator = Creator::factory()->active()->create(['country' => 'BR']);
        CreatorContractAcceptance::factory()->valid()->create([
            'creator_id' => $creator->id,
            'full_name' => $creator->full_name,
            'email' => $creator->user?->email,
        ]);

        return $creator->load('user');
    }
}
