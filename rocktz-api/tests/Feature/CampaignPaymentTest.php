<?php

namespace Tests\Feature;

use App\Enums\ApprovalFlowType;
use App\Enums\DeliveryStatus;
use App\Enums\PaymentStatus;
use App\Enums\StageApprovalStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_pay_before_content_is_approved(): void
    {
        [$token, $row] = $this->adminWithParticipation();

        $this->withToken($token)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'payment_status' => PaymentStatus::Paid->value,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_status');

        $this->assertSame(PaymentStatus::Pending, $row->fresh()->payment_status);
    }

    public function test_admin_can_pay_when_delivery_is_approved(): void
    {
        [$token, $row] = $this->adminWithParticipation([
            'delivery_status' => DeliveryStatus::Approved,
        ]);

        $this->withToken($token)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'payment_status' => PaymentStatus::Paid->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.payment_status', 'paid');

        $fresh = $row->fresh();
        $this->assertSame(PaymentStatus::Paid, $fresh->payment_status);
        $this->assertSame(now()->toDateString(), $fresh->payment_date?->toDateString());
    }

    public function test_admin_can_schedule_payment_when_content_is_approved(): void
    {
        [$token, $row] = $this->adminWithParticipation([
            'delivery_status' => DeliveryStatus::Published,
        ]);

        $this->withToken($token)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'payment_status' => PaymentStatus::Scheduled->value,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_date');

        $this->withToken($token)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'payment_status' => PaymentStatus::Scheduled->value,
                'payment_date' => '2026-09-01',
            ])
            ->assertOk()
            ->assertJsonPath('data.payment_status', 'scheduled')
            ->assertJsonPath('data.payment_date', '2026-09-01');
    }

    public function test_script_only_campaign_can_be_paid_when_script_is_approved(): void
    {
        $admin = User::factory()->admin()->create();
        $campaign = Campaign::factory()->create([
            'approval_flow' => ApprovalFlowType::ScriptOnly,
        ]);
        $row = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'script_status' => StageApprovalStatus::Approved,
            'video_status' => StageApprovalStatus::Pending,
            'delivery_status' => DeliveryStatus::Pending,
        ]);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'payment_status' => PaymentStatus::Paid->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.payment_status', 'paid');
    }

    public function test_creator_cannot_mark_own_payment_as_paid(): void
    {
        [, $row] = $this->adminWithParticipation([
            'delivery_status' => DeliveryStatus::Approved,
        ]);
        $creatorUser = $row->creator?->user;
        $this->assertNotNull($creatorUser);

        $this->withToken($creatorUser->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'payment_status' => PaymentStatus::Paid->value,
            ])
            ->assertForbidden();
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array{0: string, 1: CampaignCreator}
     */
    private function adminWithParticipation(array $attributes = []): array
    {
        $admin = User::factory()->admin()->create();
        $row = CampaignCreator::factory()->approved()->create($attributes);

        return [$admin->createToken('auth')->plainTextToken, $row];
    }
}
