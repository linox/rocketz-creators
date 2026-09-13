<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\ContentPlanningItem;
use App\Models\RecurringContract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalendarTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sees_delivery_and_post_events(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $token = $admin->createToken('auth')->plainTextToken;
        $month = now()->format('Y-m');

        $campaign = Campaign::query()->firstOrFail();
        $row = CampaignCreator::query()->first()
            ?? CampaignCreator::factory()->create(['campaign_id' => $campaign->id]);
        $row->update([
            'application_status' => ApplicationStatus::Approved,
            'delivery_date' => now()->toDateString(),
            'post_date' => now()->addDay()->toDateString(),
        ]);

        $item = ContentPlanningItem::query()->firstOrFail();
        $item->update([
            'planned_date' => now()->toDateString(),
            'post_date' => now()->addDays(2)->toDateString(),
            'month' => $month,
        ]);

        $events = $this->withToken($token)
            ->getJson("/api/calendar?month={$month}&kind=all")
            ->assertOk()
            ->json('data');

        $ids = array_column($events, 'id');
        $this->assertContains("campaign:delivery:{$row->id}", $ids);
        $this->assertContains("campaign:post:{$row->id}", $ids);
        $this->assertContains("recurring:delivery:{$item->id}", $ids);
        $this->assertContains("recurring:post:{$item->id}", $ids);
    }

    public function test_creator_only_sees_own_events_and_can_filter_posts(): void
    {
        $this->seed();

        $ana = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $token = $ana->createToken('auth')->plainTextToken;
        $creatorId = $ana->creator->id;
        $month = now()->format('Y-m');

        CampaignCreator::query()->where('creator_id', $creatorId)->update([
            'application_status' => ApplicationStatus::Approved,
            'delivery_date' => now()->toDateString(),
            'post_date' => now()->toDateString(),
        ]);

        $foreign = CampaignCreator::query()->where('creator_id', '!=', $creatorId)->first();
        if ($foreign) {
            $foreign->update([
                'application_status' => ApplicationStatus::Approved,
                'delivery_date' => now()->toDateString(),
                'post_date' => now()->toDateString(),
            ]);
        }

        $mine = ContentPlanningItem::query()->where('creator_id', $creatorId)->first();
        if ($mine) {
            $mine->update([
                'planned_date' => now()->subDay()->toDateString(),
                'post_date' => now()->toDateString(),
                'month' => $month,
            ]);
        }

        $posts = $this->withToken($token)
            ->getJson("/api/calendar?month={$month}&kind=post")
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($posts);
        foreach ($posts as $event) {
            $this->assertSame('post', $event['kind']);
            if (! empty($event['creator']['id'])) {
                $this->assertSame($creatorId, $event['creator']['id']);
            }
        }
    }

    public function test_company_only_sees_own_company_posts(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $token = $companyUser->createToken('auth')->plainTextToken;
        $companyId = $companyUser->actingCompanyId();
        $month = now()->format('Y-m');

        RecurringContract::query()->where('company_id', $companyId)->first()?->contentPlanningItems()->update([
            'post_date' => now()->toDateString(),
            'planned_date' => now()->toDateString(),
            'month' => $month,
        ]);

        $events = $this->withToken($token)
            ->getJson("/api/calendar?month={$month}&kind=post")
            ->assertOk()
            ->json('data');

        foreach ($events as $event) {
            $this->assertSame('post', $event['kind']);
            if (! empty($event['company']['id'])) {
                $this->assertSame($companyId, $event['company']['id']);
            }
        }
    }

    public function test_agency_can_set_campaign_and_demand_post_dates(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $token = $admin->createToken('auth')->plainTextToken;
        $row = CampaignCreator::query()->firstOrFail();
        $item = ContentPlanningItem::query()->firstOrFail();

        $this->withToken($token)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'delivery_date' => now()->toDateString(),
                'post_date' => now()->addDays(3)->toDateString(),
            ])
            ->assertOk()
            ->assertJsonPath('data.delivery_date', now()->toDateString())
            ->assertJsonPath('data.post_date', now()->addDays(3)->toDateString());

        $this->app['auth']->forgetGuards();
        $this->withToken($token)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'planned_date' => now()->toDateString(),
                'post_date' => now()->addDays(5)->toDateString(),
            ])
            ->assertOk()
            ->assertJsonPath('data.planned_date', now()->toDateString())
            ->assertJsonPath('data.post_date', now()->addDays(5)->toDateString());
    }
}
