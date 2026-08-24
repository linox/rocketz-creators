<?php

namespace Tests\Feature;

use App\Enums\ContentPlanningStatus;
use App\Enums\MailMessageStatus;
use App\Enums\MailTemplateKey;
use App\Jobs\SendTransactionalMailJob;
use App\Mail\TransactionalMailable;
use App\Models\Campaign;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\MailMessage;
use App\Models\User;
use App\Models\UserNotificationPreference;
use App\Services\Mail\TransactionalMailService;
use Database\Seeders\MailTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class TransactionalMailTest extends TestCase
{
    use RefreshDatabase;

    public function test_creator_registration_queues_operational_email(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register/creator', [
            'full_name' => 'Maria Silva',
            'artistic_name' => 'mariasilva',
            'email' => 'maria@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'whatsapp' => '11999999999',
            'city' => 'São Paulo',
            'state' => 'SP',
            'instagram' => 'mariasilva',
            'category' => 'UGC Content',
            'lgpd_accepted' => true,
        ])->assertCreated();

        $this->assertDatabaseHas('mail_messages', [
            'email' => 'maria@example.com',
            'template_key' => MailTemplateKey::CreatorRegistered->value,
        ]);
        Mail::assertSent(TransactionalMailable::class);
    }

    public function test_company_registration_queues_operational_email(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register/company', [
            'name' => 'Marca Teste',
            'responsible_name' => 'João Souza',
            'email' => 'joao@marca.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'whatsapp' => '11988887777',
            'city' => 'Curitiba',
            'state' => 'PR',
            'segment' => 'Varejo',
            'lgpd_accepted' => true,
        ])->assertCreated();

        $this->assertDatabaseHas('mail_messages', [
            'email' => 'joao@marca.com',
            'template_key' => MailTemplateKey::CompanyRegistered->value,
        ]);
    }

    public function test_approving_creator_sends_approved_email(): void
    {
        Mail::fake();
        $admin = User::factory()->admin()->create();
        $creator = Creator::factory()->review()->create();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/approve")
            ->assertOk();

        $this->assertDatabaseHas('mail_messages', [
            'email' => $creator->user->email,
            'template_key' => MailTemplateKey::CreatorApproved->value,
        ]);
    }

    public function test_rejecting_creator_includes_reason_when_provided(): void
    {
        Mail::fake();
        $admin = User::factory()->admin()->create();
        $creator = Creator::factory()->review()->create();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/reject", ['reason' => 'Perfil incompleto'])
            ->assertOk();

        $message = MailMessage::query()
            ->where('template_key', MailTemplateKey::CreatorRejected->value)
            ->firstOrFail();
        $this->assertSame('Perfil incompleto', $message->payload['variables']['motivo_reprovacao'] ?? null);
    }

    public function test_approving_company_sends_email_to_company_users(): void
    {
        Mail::fake();
        $admin = User::factory()->admin()->create();
        $company = Company::factory()->pending()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->pending()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/companies/{$company->id}/approve")
            ->assertOk();

        $this->assertDatabaseHas('mail_messages', [
            'email' => $user->email,
            'template_key' => MailTemplateKey::CompanyApproved->value,
        ]);
    }

    public function test_second_send_is_idempotent(): void
    {
        Mail::fake();
        $creator = Creator::factory()->active()->create();
        $mail = app(TransactionalMailService::class);

        $first = $mail->send(MailTemplateKey::CreatorApproved, $creator->user, [
            'cta_url' => 'https://example.test',
        ], $creator);
        $second = $mail->send(MailTemplateKey::CreatorApproved, $creator->user, [
            'cta_url' => 'https://example.test',
        ], $creator);

        $this->assertNotNull($first);
        $this->assertNull($second);
        $this->assertSame(1, MailMessage::query()->where('template_key', MailTemplateKey::CreatorApproved->value)->count());
    }

    public function test_opportunity_pref_can_be_disabled_without_blocking_operational_mail(): void
    {
        Mail::fake();
        $creator = Creator::factory()->active()->create();
        UserNotificationPreference::query()->create([
            'user_id' => $creator->user_id,
            'opportunities' => false,
            'campaign_updates' => true,
            'new_demands' => true,
            'deadline_reminders' => true,
            'delivery_updates' => true,
            'promotional' => true,
        ]);
        $campaign = Campaign::factory()->create(['is_secret' => false]);
        $mail = app(TransactionalMailService::class);

        $this->assertNull($mail->send(
            MailTemplateKey::CampaignOpportunity,
            $creator->user->fresh('notificationPreference'),
            ['cta_url' => 'https://example.test/campaigns/'.$campaign->id, 'link_campanha' => 'https://example.test'],
            $campaign,
            'opportunity:'.$creator->id,
        ));
        $this->assertNotNull($mail->send(
            MailTemplateKey::CreatorApproved,
            $creator->user->fresh('notificationPreference'),
            ['cta_url' => 'https://example.test'],
            $creator,
        ));
    }

    public function test_applying_to_campaign_emails_creator_and_company(): void
    {
        Mail::fake();
        $this->seed();

        $creator = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $token = $creator->createToken('auth')->plainTextToken;
        $campaignId = $this->withToken($token)->getJson('/api/campaigns/available')->json('data.0.id');

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaignId}/apply", ['notes' => 'Quero participar'])
            ->assertCreated();

        $this->assertDatabaseHas('mail_messages', [
            'email' => 'ana.creator@rocketz.test',
            'template_key' => MailTemplateKey::CampaignApplicationReceived->value,
        ]);
        $this->assertDatabaseHas('mail_messages', [
            'email' => 'empresa@rocketz.test',
            'template_key' => MailTemplateKey::CampaignCreatorApplied->value,
        ]);
    }

    public function test_reminder_is_skipped_when_demand_already_delivered(): void
    {
        Mail::fake();
        $item = ContentPlanningItem::factory()->create([
            'planned_date' => now()->addDays(3)->toDateString(),
            'status' => ContentPlanningStatus::Approved,
        ]);

        $this->artisan('mail:reminders')->assertSuccessful();

        $this->assertDatabaseMissing('mail_messages', [
            'template_key' => MailTemplateKey::DemandReminder->value,
            'related_id' => $item->id,
        ]);
    }

    public function test_queued_reminder_is_cancelled_if_status_changes_before_send(): void
    {
        $item = ContentPlanningItem::factory()->create([
            'planned_date' => now()->addDays(3)->toDateString(),
            'status' => ContentPlanningStatus::Planned,
        ]);
        $user = $item->creator->user;
        $copy = app(TransactionalMailService::class)->defaultCopy(MailTemplateKey::DemandReminder, 'pt_BR');
        $message = MailMessage::query()->create([
            'user_id' => $user->id,
            'email' => $user->email,
            'template_key' => MailTemplateKey::DemandReminder,
            'subject' => $copy['subject'],
            'status' => MailMessageStatus::Queued,
            'idempotency_key' => 'test-reminder-cancel',
            'related_type' => ContentPlanningItem::class,
            'related_id' => $item->id,
            'payload' => [
                'copy' => $copy,
                'variables' => [
                    'cta_url' => 'https://example.test',
                    'link_demanda' => 'https://example.test',
                ],
            ],
        ]);
        $item->update(['status' => ContentPlanningStatus::Approved]);

        Mail::fake();
        SendTransactionalMailJob::dispatchSync($message->id);

        $this->assertSame(MailMessageStatus::Cancelled, $message->fresh()->status);
        Mail::assertNothingSent();
    }

    public function test_resend_webhook_marks_message_delivered(): void
    {
        $user = User::factory()->create();
        $message = MailMessage::query()->create([
            'user_id' => $user->id,
            'email' => $user->email,
            'template_key' => MailTemplateKey::CreatorApproved,
            'subject' => 'ok',
            'status' => MailMessageStatus::Sent,
            'provider_id' => 're_abc',
            'idempotency_key' => 'webhook-test',
            'payload' => [],
        ]);

        $this->postJson('/api/webhooks/resend', [
            'type' => 'email.delivered',
            'data' => ['email_id' => 're_abc'],
        ])->assertOk();

        config(['services.resend.webhook_secret' => 'whsec_test']);
        $this->postJson('/api/webhooks/resend', [
            'type' => 'email.delivered',
            'data' => ['email_id' => 're_abc'],
        ])->assertUnauthorized();

        $this->assertSame(MailMessageStatus::Delivered, $message->fresh()->status);
        $this->assertNotNull($message->fresh()->delivered_at);
    }

    public function test_notification_preferences_round_trip(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/notification-preferences')
            ->assertOk()
            ->assertJsonPath('data.opportunities', true);

        $this->withToken($token)
            ->patchJson('/api/notification-preferences', ['opportunities' => false])
            ->assertOk()
            ->assertJsonPath('data.opportunities', false);
    }

    public function test_admin_can_list_mail_templates_and_creator_cannot(): void
    {
        $this->seed(MailTemplateSeeder::class);
        $admin = User::factory()->admin()->create();
        $creator = User::factory()->creator()->create();

        $response = $this->withToken($admin->createToken('auth')->plainTextToken)
            ->getJson('/api/mail/templates')
            ->assertOk();
        $this->assertTrue(collect($response->json('data'))->pluck('key')->contains(MailTemplateKey::CreatorRegistered->value));

        $this->flushHeaders();
        $this->actingAs($creator, 'sanctum')
            ->getJson('/api/mail/templates')
            ->assertForbidden();
    }

    public function test_global_kill_switch_blocks_sends(): void
    {
        Mail::fake();
        app(TransactionalMailService::class)->setSendingEnabled(false);

        $this->postJson('/api/auth/register/creator', [
            'full_name' => 'Maria Silva',
            'artistic_name' => 'mariasilva',
            'email' => 'maria.pause@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'whatsapp' => '11999999999',
            'city' => 'São Paulo',
            'state' => 'SP',
            'instagram' => 'mariasilva',
            'category' => 'UGC Content',
            'lgpd_accepted' => true,
        ])->assertCreated();

        $this->assertDatabaseCount('mail_messages', 0);
        Mail::assertNothingSent();
    }

    public function test_admin_can_toggle_sending(): void
    {
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson('/api/mail/settings', ['sending_enabled' => false])
            ->assertOk()
            ->assertJsonPath('data.sending_enabled', false)
            ->assertJsonPath('data.stored_enabled', false);

        $this->withToken($token)
            ->getJson('/api/mail/settings')
            ->assertOk()
            ->assertJsonPath('data.sending_enabled', false);
    }

    public function test_env_lock_keeps_sending_off(): void
    {
        config(['mail.sending_enabled' => false]);
        app(TransactionalMailService::class)->setSendingEnabled(true);

        $this->assertFalse(app(TransactionalMailService::class)->sendingEnabled());
    }
}
