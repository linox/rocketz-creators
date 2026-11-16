<?php

namespace Tests\Feature;

use App\Enums\ContentType;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\CampaignDemand;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\ContentPlanningItem;
use App\Models\CreatorVideo;
use App\Models\CreatorVideoUsage;
use App\Models\RecurringContract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreatorVideoLibraryTest extends TestCase
{
    use RefreshDatabase;

    public function test_library_tracks_received_videos_posts_and_ads(): void
    {
        [$company, $user] = $this->companyUser();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'name' => 'Verao Aurora',
        ]);
        $participation = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
        ]);
        $unused = $this->demand($participation, 1, [
            'video_url' => 'https://cdn.example.com/reel-novo.mp4',
        ]);
        $posted = $this->demand($participation, 2, [
            'video_url' => 'https://cdn.example.com/reel-publicado.mp4',
            'published_link' => 'https://instagram.com/p/aurora',
            'delivery_status' => 'published',
        ]);
        $this->demand($participation, 3, [
            'content_type' => 'stories',
            'video_url' => null,
            'image_url' => 'https://cdn.example.com/print.jpg',
        ]);

        $contract = RecurringContract::factory()->create([
            'company_id' => $company->id,
            'title' => 'Mensal Aurora',
        ]);
        $planning = ContentPlanningItem::factory()->create([
            'recurring_contract_id' => $contract->id,
            'company_id' => $company->id,
            'creator_id' => $participation->creator_id,
            'title' => 'Unboxing de março',
            'content_type' => ContentType::Ugc,
            'media_url' => 'https://cdn.example.com/unboxing.mp4',
        ]);
        ContentPlanningItem::factory()->create([
            'recurring_contract_id' => $contract->id,
            'company_id' => $company->id,
            'creator_id' => $participation->creator_id,
            'title' => 'Só a foto',
            'media_url' => 'https://cdn.example.com/capa.jpg',
        ]);

        $otherCompany = Company::factory()->active()->create();
        $otherCampaign = Campaign::factory()->create(['company_id' => $otherCompany->id]);
        $otherParticipation = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $otherCampaign->id,
        ]);
        $this->demand($otherParticipation, 1, [
            'video_url' => 'https://cdn.example.com/outro.mp4',
        ]);

        $list = $this->asUser($user)
            ->getJson('/api/creator-videos')
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.unused', 2)
            ->assertJsonPath('meta.posted', 1)
            ->assertJsonPath('meta.ad', 0)
            ->assertJsonCount(3, 'data');

        $rows = collect($list->json('data'));
        $fresh = $rows->firstWhere('title', 'Reel 1');
        $published = $rows->firstWhere('title', 'Reel 2');
        $recurring = $rows->firstWhere('title', 'Unboxing de março');

        $this->assertNotNull($fresh);
        $this->assertSame('unused', $fresh['status']);
        $this->assertSame('Verao Aurora', $fresh['campaign_name']);
        $this->assertTrue($fresh['can_manage']);
        $this->assertSame([], $fresh['usages']);

        $this->assertSame('posted', $published['status']);
        $this->assertSame('auto', $published['usages'][0]['source']);
        $this->assertSame('posted', $published['usages'][0]['kind']);
        $this->assertSame('https://instagram.com/p/aurora', $published['usages'][0]['url']);

        $this->assertSame('recurring', $recurring['source']);
        $this->assertSame('Mensal Aurora', $recurring['contract_name']);
        $this->assertSame('unused', $recurring['status']);

        $this->asUser($user)
            ->getJson('/api/creator-videos')
            ->assertOk()
            ->assertJsonPath('meta.posted', 1);
        $this->assertSame(1, CreatorVideoUsage::query()->where('kind', 'posted')->count());

        $this->asUser($user)
            ->postJson("/api/creator-videos/{$recurring['id']}/usages", [
                'kind' => 'ad',
                'url' => 'https://ads.example.com/aurora',
                'note' => 'Impulsionado em março',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'ad')
            ->assertJsonPath('data.usages.0.kind', 'ad')
            ->assertJsonPath('data.usages.0.source', 'manual')
            ->assertJsonPath('data.usages.0.note', 'Impulsionado em março');

        $this->asUser($user)
            ->postJson("/api/creator-videos/{$fresh['id']}/usages", [
                'kind' => 'posted',
                'url' => 'não é um link',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('url');

        $this->asUser($participation->creator->user)
            ->getJson('/api/creator-videos')
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('data.0.can_manage', false);

        $this->asUser($participation->creator->user)
            ->postJson("/api/creator-videos/{$fresh['id']}/usages", ['kind' => 'ad'])
            ->assertForbidden();

        $otherUser = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $otherUser->id,
            'company_id' => $otherCompany->id,
        ]);
        $this->asUser($otherUser)
            ->getJson('/api/creator-videos')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.video_url', 'https://cdn.example.com/outro.mp4');

        $this->asUser($otherUser)
            ->postJson("/api/creator-videos/{$fresh['id']}/usages", ['kind' => 'ad'])
            ->assertNotFound();

        $admin = User::factory()->admin()->create();
        $this->asUser($admin)
            ->getJson('/api/creator-videos')
            ->assertOk()
            ->assertJsonPath('meta.total', 4);

        $this->assertSame($unused->id, CreatorVideo::query()->where('title', 'Reel 1')->value('campaign_demand_id'));
        $this->assertSame($posted->id, CreatorVideo::query()->where('title', 'Reel 2')->value('campaign_demand_id'));
        $this->assertSame($planning->id, CreatorVideo::query()->where('title', 'Unboxing de março')->value('content_planning_item_id'));
    }

    public function test_removed_campaign_post_stays_out_of_the_history(): void
    {
        [$company, $user] = $this->companyUser();
        $campaign = Campaign::factory()->create(['company_id' => $company->id]);
        $participation = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
        ]);
        $this->demand($participation, 1, [
            'published_link' => 'https://instagram.com/p/remover',
        ]);

        $list = $this->asUser($user)->getJson('/api/creator-videos')->assertOk();
        $videoId = $list->json('data.0.id');
        $usageId = $list->json('data.0.usages.0.id');

        $this->asUser($user)
            ->deleteJson("/api/creator-videos/{$videoId}/usages/{$usageId}")
            ->assertOk()
            ->assertJsonPath('data.status', 'unused')
            ->assertJsonCount(0, 'data.usages');

        $this->asUser($user)
            ->getJson('/api/creator-videos')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'unused')
            ->assertJsonCount(0, 'data.0.usages');
    }

    public function test_legacy_content_video_is_listed_when_there_is_no_demand_file(): void
    {
        [$company, $user] = $this->companyUser();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'name' => 'Campanha antiga',
        ]);
        $participation = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'delivery_type' => 'reels',
        ]);
        $participation->content()->create([
            'video_url' => 'https://cdn.example.com/legado.mp4',
            'published_link' => 'https://instagram.com/p/legado',
        ]);

        $this->asUser($user)
            ->getJson('/api/creator-videos')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.title', 'Reel')
            ->assertJsonPath('data.0.status', 'posted')
            ->assertJsonPath('data.0.campaign_name', 'Campanha antiga');
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function demand(CampaignCreator $row, int $position, array $extra = []): CampaignDemand
    {
        return CampaignDemand::query()->create(array_merge([
            'campaign_creator_id' => $row->id,
            'content_type' => 'reels',
            'position' => $position,
            'video_status' => 'approved',
            'delivery_status' => 'approved',
            'video_url' => "https://cdn.example.com/reel-{$position}.mp4",
            'video_submitted_at' => now()->subDay(),
        ], $extra));
    }

    /**
     * @return array{0: Company, 1: User}
     */
    private function companyUser(): array
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);

        return [$company, $user];
    }

    private function asUser(User $user): static
    {
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        return $this->withHeaders(['Accept-Language' => 'pt-BR'])
            ->withToken($user->createToken('auth')->plainTextToken);
    }
}
