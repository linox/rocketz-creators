<?php

namespace Tests\Feature;

use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationInboxTest extends TestCase
{
    use RefreshDatabase;

    public function test_inbox_shows_one_card_per_event_even_when_every_recipient_was_notified(): void
    {
        $company = Company::factory()->create();
        $memberA = User::factory()->company()->create();
        $memberB = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $memberA->id,
            'company_id' => $company->id,
        ]);
        CompanyUser::factory()->active()->create([
            'user_id' => $memberB->id,
            'company_id' => $company->id,
        ]);

        $adminA = User::factory()->admin()->create();
        $adminB = User::factory()->admin()->create();
        $message = 'O criador enviou o vídeo de "Mostrando o potencial da cricut maker" em Cricut Brasil - Q4 2026.';

        $service = app(NotificationService::class);
        $payload = [
            'title' => 'Vídeo enviado',
            'message' => $message,
            'type' => NotificationType::DeliveryReview,
            'link' => '/recurring/9',
            'recurring_contract_id' => null,
        ];

        $service->notifyCompany($company->id, $payload);
        $service->notifyCompany($company->id, $payload);
        $service->notifyAdmins(
            $payload['title'],
            $message,
            NotificationType::DeliveryReview,
            '/recurring/9',
        );
        $service->notifyAdmins(
            $payload['title'],
            $message,
            NotificationType::DeliveryReview,
            '/recurring/9',
        );

        Notification::factory()->create([
            'user_id' => $adminA->id,
            'title' => 'Vídeo enviado',
            'message' => $message,
            'type' => NotificationType::DeliveryReview,
            'target_role' => NotificationTargetRole::Admin,
            'link' => '/recurring/9',
            'read' => false,
        ]);

        $this->assertSame(3, Notification::query()->where('target_role', NotificationTargetRole::Admin)->count());
        $this->assertSame(2, Notification::query()->where('target_role', NotificationTargetRole::Company)->count());

        $adminToken = $adminA->createToken('auth')->plainTextToken;
        $inbox = $this->withToken($adminToken)->getJson('/api/notifications')->assertOk()->json('data');

        $this->assertCount(1, $this->matching($inbox, 'admin', $message));
        $this->assertCount(1, $this->matching($inbox, 'company', $message));
        $this->withToken($adminToken)->getJson('/api/nav')->assertOk()->assertJsonPath('unread', 1);

        $this->app['auth']->forgetGuards();
        $companyInbox = $this->withToken($memberA->createToken('auth')->plainTextToken)
            ->getJson('/api/notifications')
            ->assertOk()
            ->json('data');
        $this->assertCount(1, $companyInbox);
        $this->assertSame('company', $companyInbox[0]['target_role']);

        $this->app['auth']->forgetGuards();
        $shownId = $this->matching($inbox, 'admin', $message)[0]['id'];
        $this->withToken($adminToken)
            ->deleteJson('/api/notifications/'.$shownId)
            ->assertOk();

        $this->assertSame(0, Notification::query()->where('user_id', $adminA->id)->count());
        $this->assertSame(1, Notification::query()->where('user_id', $adminB->id)->count());
        $this->assertFalse((bool) Notification::query()->where('user_id', $memberA->id)->value('read'));
    }

    public function test_same_day_resubmission_stays_visible_when_the_message_changes(): void
    {
        $admin = User::factory()->admin()->create();
        $service = app(NotificationService::class);

        $service->notifyAdmins('Vídeo enviado', 'Primeira versão.', NotificationType::DeliveryReview, '/recurring/9');
        $this->travel(3)->minutes();
        $service->notifyAdmins('Vídeo enviado', 'Segunda versão.', NotificationType::DeliveryReview, '/recurring/9');

        $inbox = $this->withToken($admin->createToken('auth')->plainTextToken)
            ->getJson('/api/notifications')
            ->assertOk()
            ->json('data');

        $this->assertCount(2, $inbox);
    }

    /**
     * @param  list<array<string, mixed>>  $inbox
     * @return list<array<string, mixed>>
     */
    private function matching(array $inbox, string $role, string $message): array
    {
        return array_values(array_filter(
            $inbox,
            fn (array $row) => $row['target_role'] === $role && $row['message'] === $message,
        ));
    }
}
