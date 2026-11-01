<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Enums\ContentPlanningStatus;
use App\Enums\DeliveryStatus;
use App\Enums\StageApprovalStatus;
use App\Models\Campaign;
use App\Models\Notification;
use App\Models\CampaignCreator;
use App\Models\CampaignDemand;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\RecurringContract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class BrowserAlertTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_guest_cannot_list_browser_alerts(): void
    {
        $this->getJson('/api/browser-alerts')->assertUnauthorized();
    }

    public function test_reviewers_are_notified_for_script_delivery_and_overdue_work(): void
    {
        Carbon::setTestNow('2026-11-01 09:00:00');
        [$company, $member] = $this->companyMember();
        $creator = Creator::factory()->active()->create(['artistic_name' => 'Ana']);
        $overdueUser = User::factory()->creator()->create();
        $overdueCreator = Creator::factory()->active()->create(['user_id' => $overdueUser->id]);
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'name' => 'Campanha Glow',
            'status' => CampaignStatus::Production,
            'delivery_date' => '2026-11-20',
        ]);

        $script = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'delivery_date' => '2026-11-20',
            'script_status' => StageApprovalStatus::Submitted,
            'script_submitted_at' => now(),
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => Creator::factory()->active(),
            'delivery_date' => '2026-11-20',
            'video_status' => StageApprovalStatus::Submitted,
            'video_submitted_at' => now(),
            'delivery_status' => DeliveryStatus::Sent,
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $overdueCreator->id,
            'delivery_date' => '2026-10-20',
            'script_status' => StageApprovalStatus::Pending,
            'video_status' => StageApprovalStatus::Pending,
            'delivery_status' => DeliveryStatus::Pending,
        ]);
        CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => Creator::factory()->active(),
            'application_status' => ApplicationStatus::Pending,
            'script_status' => StageApprovalStatus::Submitted,
            'script_submitted_at' => now(),
        ]);

        $other = $this->companyMember()[1];
        $admin = User::factory()->admin()->create();

        $companyAlerts = $this->alerts($member);
        $kinds = collect($companyAlerts)->pluck('kind')->all();
        $this->assertEqualsCanonicalizing(['script_sent', 'delivery_received', 'delivery_overdue'], $kinds);
        $scriptAlert = collect($companyAlerts)->firstWhere('kind', 'script_sent');
        $this->assertSame('Roteiro enviado', $scriptAlert['title']);
        $this->assertSame('Ana enviou o roteiro de Campanha Glow.', $scriptAlert['body']);
        $this->assertSame('campaign-'.$script->id.'-script', $scriptAlert['inbox_id']);
        $this->assertStringContainsString('/campaign-deliveries?delivery=', $scriptAlert['url']);

        $this->assertSame(['delivery_overdue'], collect($this->alerts($overdueUser))->pluck('kind')->all());
        $this->assertSame([], $this->alerts($other));
        $this->assertCount(3, $this->alerts($admin));

        $this->withHeader('Accept-Language', 'en');
        $english = User::factory()->admin()->create();
        $this->assertSame('Script submitted', collect($this->alerts($english))->firstWhere('kind', 'script_sent')['title']);
    }

    public function test_script_and_video_received_notify_as_soon_as_they_arrive(): void
    {
        [$company, $member] = $this->companyMember();
        $creatorUser = User::factory()->creator()->create();
        $creator = Creator::factory()->active()->create([
            'user_id' => $creatorUser->id,
            'artistic_name' => 'Ana',
        ]);
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'name' => 'Campanha Glow',
            'status' => CampaignStatus::Production,
            'delivery_date' => now()->addWeek()->toDateString(),
        ]);
        $row = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'delivery_date' => now()->addWeek()->toDateString(),
        ]);

        $this->app['auth']->forgetGuards();
        $this->withToken($creatorUser->createToken('script')->plainTextToken)
            ->patchJson('/api/campaign-creators/'.$row->id, [
                'script_status' => 'submitted',
                'script' => 'Abre com o produto na mão.',
            ])
            ->assertOk();

        $this->assertSame(1, Notification::query()->where('user_id', $member->id)->where('title', 'Roteiro enviado')->count());
        $this->assertSame(['script_sent'], collect($this->alerts($member))->pluck('kind')->all());

        $this->app['auth']->forgetGuards();
        $this->withToken($creatorUser->createToken('video')->plainTextToken)
            ->patchJson('/api/campaign-creators/'.$row->id, [
                'video_status' => 'submitted',
                'delivery_status' => 'sent',
            ])
            ->assertOk();

        $this->assertSame(1, Notification::query()->where('user_id', $member->id)->where('title', 'Vídeo enviado')->count());
        $this->assertSame(['delivery_received'], collect($this->alerts($member))->pluck('kind')->all());
    }

    public function test_alerts_repeat_until_seen_and_reset_when_the_delivery_moves(): void
    {
        $start = Carbon::parse('2026-11-01 08:00:00');
        Carbon::setTestNow($start);
        [$company, $member] = $this->companyMember();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'name' => 'Campanha Glow',
            'status' => CampaignStatus::Production,
        ]);
        $row = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'delivery_date' => '2026-11-20',
            'script_status' => StageApprovalStatus::Submitted,
            'script_submitted_at' => $start,
        ]);

        $this->assertCount(1, $this->alerts($member));
        $this->assertSame([], $this->alerts($member));

        Carbon::setTestNow($start->copy()->addHours(4));
        $again = $this->alerts($member);
        $this->assertSame('script_sent', $again[0]['kind']);

        Carbon::setTestNow($start->copy()->addHours(8));
        $this->assertCount(1, $this->alerts($member));
        Carbon::setTestNow($start->copy()->addHours(12));
        $this->assertSame([], $this->alerts($member));

        Carbon::setTestNow($start->copy()->addDay()->setTime(9, 0));
        $nextDay = $this->alerts($member);
        $this->assertCount(1, $nextDay);
        $this->seen($member, ['key' => $nextDay[0]['key']]);

        Carbon::setTestNow($start->copy()->addDay()->setTime(18, 0));
        $this->assertSame([], $this->alerts($member));

        $row->forceFill(['script_submitted_at' => now(), 'script_status' => StageApprovalStatus::Submitted])->save();
        $moved = $this->alerts($member);
        $this->assertSame('script_sent', $moved[0]['kind']);

        $this->seen($member, ['inbox_id' => 'campaign-'.$row->id.'-script']);
        Carbon::setTestNow(now()->addHours(5));
        $this->assertSame([], $this->alerts($member));
    }

    public function test_demand_script_and_recurring_overdue_are_scoped(): void
    {
        Carbon::setTestNow('2026-11-01 10:00:00');
        [$company, $member] = $this->companyMember();
        $creatorUser = User::factory()->creator()->create();
        $creator = Creator::factory()->active()->create([
            'user_id' => $creatorUser->id,
            'artistic_name' => 'Lia',
        ]);
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'name' => 'Campanha Demanda',
            'status' => CampaignStatus::Production,
            'delivery_date' => '2026-11-18',
        ]);
        $row = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'delivery_date' => '2026-11-18',
            'script_status' => StageApprovalStatus::Pending,
        ]);
        $demand = CampaignDemand::query()->create([
            'campaign_creator_id' => $row->id,
            'content_type' => 'reels',
            'position' => 1,
            'script_status' => StageApprovalStatus::Submitted,
            'script_submitted_at' => now(),
            'script_version' => 2,
        ]);

        $contract = RecurringContract::factory()->create([
            'company_id' => $company->id,
            'title' => 'Mensal',
        ]);
        $item = ContentPlanningItem::factory()->create([
            'recurring_contract_id' => $contract->id,
            'company_id' => $company->id,
            'creator_id' => $creator->id,
            'title' => 'Pauta de outubro',
            'status' => ContentPlanningStatus::InProduction,
            'briefing' => 'Brief definido',
            'planned_date' => '2026-10-15',
            'post_date' => '2026-10-15',
            'month' => '2026-10',
            'script_status' => StageApprovalStatus::Pending,
            'video_status' => StageApprovalStatus::Pending,
        ]);

        $reviewer = collect($this->alerts($member));
        $script = $reviewer->firstWhere('kind', 'script_sent');
        $this->assertSame('script:demand:'.$demand->id, $script['key']);
        $this->assertSame('campaign-'.$row->id.'-d'.$demand->id.'-script', $script['inbox_id']);
        $overdue = $reviewer->firstWhere('kind', 'delivery_overdue');
        $this->assertSame('overdue:planning:'.$item->id, $overdue['key']);
        $this->assertStringContainsString('/recurring/'.$contract->id, $overdue['url']);

        $creatorAlerts = collect($this->alerts($creatorUser));
        $this->assertSame(['delivery_overdue'], $creatorAlerts->pluck('kind')->all());
        $this->assertStringContainsString('/creators/'.$creator->id.'?tab=recurring', $creatorAlerts->first()['url']);
        $this->assertSame('A entrega de Pauta de outubro está atrasada.', $creatorAlerts->first()['body']);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function alerts(User $user): array
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('auth')->plainTextToken)
            ->getJson('/api/browser-alerts')
            ->assertOk()
            ->json('data');
    }

    /**
     * @param  array{key?: string, inbox_id?: string}  $body
     */
    private function seen(User $user, array $body): void
    {
        $this->app['auth']->forgetGuards();
        $this->withToken($user->createToken('seen')->plainTextToken)
            ->postJson('/api/browser-alerts/seen', $body)
            ->assertOk();
    }

    /**
     * @return array{0: Company, 1: User}
     */
    private function companyMember(): array
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create(['active_company_id' => $company->id]);
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);

        return [$company, $user];
    }
}
