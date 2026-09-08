<?php

namespace Tests\Feature;

use App\Enums\ApprovalFlowType;
use App\Enums\ContentPlanningStatus;
use App\Enums\ContentType;
use App\Enums\StageApprovalStatus;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LivePautaTest extends TestCase
{
    use RefreshDatabase;

    public function test_generated_live_demand_uses_live_link_flow(): void
    {
        $admin = User::factory()->admin()->create();
        $contract = RecurringContract::factory()->create();
        $creator = Creator::factory()->active()->create();
        $token = $admin->createToken('auth')->plainTextToken;
        $month = now()->format('Y-m');

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $creator->id,
                'start_date' => now()->startOfMonth()->toDateString(),
                'monthly_cache' => 800,
                'monthly_deliverables' => [
                    'live_instagram' => 1,
                ],
            ])
            ->assertCreated();

        $item = ContentPlanningItem::query()
            ->where('recurring_contract_id', $contract->id)
            ->where('creator_id', $creator->id)
            ->where('month', $month)
            ->where('content_type', ContentType::LiveInstagram)
            ->firstOrFail();

        $this->assertSame(ApprovalFlowType::LiveLink, $item->approval_flow);
        $this->assertSame(ContentPlanningStatus::Planned, $item->status);
        $this->assertNull($item->briefing);
    }

    public function test_filling_live_pauta_keeps_live_link_flow(): void
    {
        $admin = User::factory()->admin()->create();
        $creator = Creator::factory()->active()->create();
        $item = ContentPlanningItem::factory()->create([
            'creator_id' => $creator->id,
            'content_type' => ContentType::LiveInstagram,
            'title' => null,
            'briefing' => null,
            'briefing_fields' => null,
            'approval_flow' => ApprovalFlowType::LiveLink,
            'status' => ContentPlanningStatus::Planned,
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $item->recurring_contract_id,
            'creator_id' => $creator->id,
        ]);
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'title' => 'Live de lançamento',
                'content_type' => ContentType::LiveInstagram->value,
                'briefing_fields' => [
                    'product' => 'Sérum Aurora',
                    'key_message' => 'Responder dúvidas ao vivo',
                ],
                'script' => 'Abertura, produto, Q&A',
            ])
            ->assertOk()
            ->assertJsonPath('data.approval_flow', 'live_link')
            ->assertJsonPath('data.briefing_fields.product', 'Sérum Aurora')
            ->assertJsonPath('data.script', 'Abertura, produto, Q&A');
    }

    public function test_creator_cannot_submit_live_script_or_link_before_briefing(): void
    {
        $creator = Creator::factory()->active()->create();
        $item = ContentPlanningItem::factory()->create([
            'creator_id' => $creator->id,
            'content_type' => ContentType::LiveInstagram,
            'title' => null,
            'briefing' => null,
            'briefing_note' => null,
            'briefing_fields' => null,
            'script' => null,
            'pauta_script_file_url' => null,
            'status' => ContentPlanningStatus::Planned,
            'approval_flow' => ApprovalFlowType::LiveLink,
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $item->recurring_contract_id,
            'creator_id' => $creator->id,
        ]);
        $token = $creator->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'script' => 'Roteiro da live',
                'script_status' => StageApprovalStatus::Submitted->value,
                'status' => 'review',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', __('auth.pauta_awaiting_briefing'));

        $this->withToken($token)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'published_url' => 'https://instagram.com/live/aurora',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', __('auth.pauta_awaiting_briefing'));
    }

    public function test_live_script_then_link_flow(): void
    {
        $admin = User::factory()->admin()->create();
        $creator = Creator::factory()->active()->create();
        $item = ContentPlanningItem::factory()->create([
            'creator_id' => $creator->id,
            'content_type' => ContentType::LiveInstagram,
            'briefing' => 'Tema da live',
            'briefing_fields' => ['product' => 'Sérum Aurora'],
            'status' => ContentPlanningStatus::Planned,
            'approval_flow' => ApprovalFlowType::LiveLink,
            'script_status' => StageApprovalStatus::Pending,
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $item->recurring_contract_id,
            'creator_id' => $creator->id,
        ]);
        $adminToken = $admin->createToken('auth')->plainTextToken;
        $creatorToken = $creator->user->createToken('auth')->plainTextToken;

        $this->withToken($creatorToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'published_url' => 'https://instagram.com/live/too-soon',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', __('auth.live_awaiting_script_approval'));

        $this->app['auth']->forgetGuards();
        $this->withToken($creatorToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'script' => 'Abertura e Q&A',
                'script_status' => StageApprovalStatus::Submitted->value,
                'status' => 'review',
            ])
            ->assertOk()
            ->assertJsonPath('data.script_status', 'submitted')
            ->assertJsonPath('data.status', 'review');

        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'script_status' => StageApprovalStatus::Approved->value,
                'status' => 'in_production',
            ])
            ->assertOk()
            ->assertJsonPath('data.script_status', 'approved')
            ->assertJsonPath('data.approval_flow', 'live_link');

        $this->app['auth']->forgetGuards();
        $this->withToken($creatorToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'published_url' => 'https://instagram.com/live/aurora',
            ])
            ->assertOk()
            ->assertJsonPath('data.published_url', 'https://instagram.com/live/aurora')
            ->assertJsonPath('data.status', 'published');
    }
}
