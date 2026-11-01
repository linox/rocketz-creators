<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\BarterShipmentStatus;
use App\Enums\MailTemplateKey;
use App\Models\BarterShipment;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\MailMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BarterShipmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.correios.tracking_url' => 'https://correios.test']);
    }

    public function test_company_tracks_a_correios_code_and_other_accounts_stay_scoped(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'https://correios.test/api/v1/rastreio/*' => Http::response($this->trackingPayload()),
        ]);

        [$company, $user] = $this->companyUser();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => true,
            'name' => 'Kit Verao',
            'barter_details' => 'Necessaire e protetor',
        ]);
        $paid = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => false,
            'name' => 'Campanha paga',
        ]);
        $participation = $this->participant($campaign, 'Ana Luz');
        $pending = CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'application_status' => ApplicationStatus::Pending,
        ]);
        $paidParticipation = $this->participant($paid, 'Bruno Pago');

        $otherCompany = Company::factory()->active()->create();
        $otherUser = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $otherUser->id,
            'company_id' => $otherCompany->id,
        ]);

        $this->asUser($user)
            ->getJson('/api/barter-shipments')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.campaign_creator_id', $participation->id)
            ->assertJsonPath('data.0.campaign.name', 'Kit Verao')
            ->assertJsonPath('data.0.can_manage', true)
            ->assertJsonPath('data.0.shipment.method', 'correios')
            ->assertJsonPath('data.0.shipment.status', 'pending')
            ->assertJsonPath('data.0.shipment.tracking_code', null);

        $this->assertSame(1, BarterShipment::query()->count());

        $this->asUser($user)
            ->putJson("/api/campaign-creators/{$participation->id}/barter-shipment", [
                'method' => 'correios',
                'tracking_code' => 'oy 739642509 br',
                'notes' => 'Postado na agência',
            ])
            ->assertOk()
            ->assertJsonPath('data.shipment.method', 'correios')
            ->assertJsonPath('data.shipment.tracking_code', 'OY739642509BR')
            ->assertJsonPath('data.shipment.status', 'delivered')
            ->assertJsonPath('data.shipment.service_label', 'SEDEX (Express)')
            ->assertJsonPath('data.shipment.status_label', 'Objeto entregue ao destinatário')
            ->assertJsonPath('data.shipment.notes', 'Postado na agência')
            ->assertJsonCount(1, 'data.shipment.events');

        Http::assertSentCount(1);

        $this->asUser($user)
            ->putJson("/api/campaign-creators/{$participation->id}/barter-shipment", [
                'method' => 'correios',
                'tracking_code' => 'XX',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['tracking_code']);

        $this->asUser($user)
            ->putJson("/api/campaign-creators/{$pending->id}/barter-shipment", [
                'method' => 'hand',
            ])
            ->assertStatus(422);

        $this->asUser($user)
            ->putJson("/api/campaign-creators/{$paidParticipation->id}/barter-shipment", [
                'method' => 'hand',
            ])
            ->assertStatus(422);

        $this->asUser($otherUser)
            ->getJson('/api/barter-shipments')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->asUser($otherUser)
            ->putJson("/api/campaign-creators/{$participation->id}/barter-shipment", [
                'method' => 'hand',
            ])
            ->assertForbidden();

        $this->asUser($participation->creator->user)
            ->getJson('/api/barter-shipments')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.can_manage', false)
            ->assertJsonPath('data.0.shipment.tracking_code', 'OY739642509BR');

        $this->asUser($participation->creator->user)
            ->putJson("/api/campaign-creators/{$participation->id}/barter-shipment", [
                'method' => 'hand',
            ])
            ->assertForbidden();
    }

    public function test_approving_a_creator_on_a_barter_campaign_opens_a_shipment_waiting_for_the_code(): void
    {
        [$company, $user] = $this->companyUser();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => true,
        ]);
        $pending = CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'application_status' => ApplicationStatus::Pending,
        ]);

        $this->assertSame(0, BarterShipment::query()->count());

        $this->asUser($user)
            ->patchJson("/api/campaign-creators/{$pending->id}", [
                'application_status' => 'approved',
            ])
            ->assertOk();

        $shipment = BarterShipment::query()->where('campaign_creator_id', $pending->id)->first();
        $this->assertNotNull($shipment);
        $this->assertSame('correios', $shipment->method->value);
        $this->assertSame('pending', $shipment->status->value);
        $this->assertNull($shipment->tracking_code);

        $this->asUser($user)
            ->patchJson("/api/campaign-creators/{$pending->id}", [
                'application_status' => 'rejected',
                'rejection_reason' => 'Fora do perfil',
            ])
            ->assertOk();

        $this->assertNull(BarterShipment::query()->where('campaign_creator_id', $pending->id)->first());
    }

    public function test_hand_delivery_does_not_call_correios_and_refresh_keeps_the_saved_code_when_lookup_fails(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'https://correios.test/*' => Http::response('offline', 503),
        ]);

        [$company, $user] = $this->companyUser();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => true,
        ]);
        $hand = $this->participant($campaign, 'Clara Mao');
        $mail = $this->participant($campaign, 'Diego Correio');

        $this->asUser($user)
            ->putJson("/api/campaign-creators/{$hand->id}/barter-shipment", [
                'method' => 'hand',
            ])
            ->assertOk()
            ->assertJsonPath('data.shipment.method', 'hand')
            ->assertJsonPath('data.shipment.status', 'handed')
            ->assertJsonPath('data.shipment.tracking_code', null);

        $this->asUser($user)
            ->putJson("/api/campaign-creators/{$mail->id}/barter-shipment", [
                'method' => 'correios',
                'tracking_code' => 'NL123456789BR',
            ])
            ->assertOk()
            ->assertJsonPath('data.shipment.tracking_code', 'NL123456789BR')
            ->assertJsonPath('data.shipment.status', 'pending')
            ->assertJsonPath('data.shipment.last_error', 'unavailable');

        $this->asUser($user)
            ->postJson("/api/campaign-creators/{$mail->id}/barter-shipment/refresh")
            ->assertOk()
            ->assertJsonPath('data.shipment.tracking_code', 'NL123456789BR')
            ->assertJsonPath('data.shipment.last_error', 'unavailable');

        $this->asUser($user)
            ->putJson("/api/campaign-creators/{$mail->id}/barter-shipment", [
                'method' => 'other',
                'carrier_label' => 'Motoboy',
            ])
            ->assertOk()
            ->assertJsonPath('data.shipment.method', 'other')
            ->assertJsonPath('data.shipment.status', 'sent')
            ->assertJsonPath('data.shipment.carrier_label', 'Motoboy')
            ->assertJsonPath('data.shipment.tracking_code', null);

        Http::assertSentCount(2);
    }

    public function test_a_failed_lookup_keeps_the_saved_timeline_and_a_later_status_can_change(): void
    {
        Http::preventStrayRequests();

        [$company, $user] = $this->companyUser();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => true,
        ]);
        $participation = $this->participant($campaign, 'Eva Rastro');
        BarterShipment::query()->create([
            'campaign_creator_id' => $participation->id,
            'method' => 'correios',
            'tracking_code' => 'OY739642509BR',
            'status' => BarterShipmentStatus::InTransit,
            'status_label' => 'Objeto em trânsito',
            'service_label' => 'SEDEX',
            'events' => [[
                'occurred_at' => '2026-08-28T17:01:11+00:00',
                'status' => 'Objeto postado',
                'category' => 'POSTADO',
                'details' => null,
                'origin' => 'Agência',
                'destination' => null,
            ]],
            'posted_at' => '2026-08-28 17:01:11',
        ]);

        Http::fake([
            'https://correios.test/api/v1/rastreio/*' => Http::sequence()
                ->push([
                    'sucesso' => false,
                    'status' => 'NAO_ENCONTRADO',
                    'eventos' => [],
                ])
                ->push([
                    'sucesso' => true,
                    'status' => 'SAIU_ENTREGA',
                    'descricaoStatus' => 'Saiu para entrega ao destinatário',
                    'servico' => ['descricao' => 'SEDEX'],
                    'entregue' => false,
                    'eventos' => [],
                ]),
        ]);

        $this->asUser($user)
            ->postJson("/api/campaign-creators/{$participation->id}/barter-shipment/refresh")
            ->assertOk()
            ->assertJsonPath('data.shipment.status', 'in_transit')
            ->assertJsonPath('data.shipment.status_label', 'Objeto em trânsito')
            ->assertJsonPath('data.shipment.service_label', 'SEDEX')
            ->assertJsonPath('data.shipment.events.0.status', 'Objeto postado')
            ->assertJsonPath('data.shipment.last_error', 'unavailable');

        $this->asUser($user)
            ->postJson("/api/campaign-creators/{$participation->id}/barter-shipment/refresh")
            ->assertOk()
            ->assertJsonPath('data.shipment.status', 'out_for_delivery')
            ->assertJsonPath('data.shipment.status_label', 'Saiu para entrega ao destinatário')
            ->assertJsonPath('data.shipment.events.0.status', 'Objeto postado')
            ->assertJsonPath('data.shipment.last_error', null);
    }

    public function test_tracking_sync_marks_delivery_once_and_campaigns_show_it(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'https://correios.test/api/v1/rastreio/*' => Http::response($this->trackingPayload()),
        ]);

        [$company, $user] = $this->companyUser();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => true,
            'name' => 'Kit Entrega',
        ]);
        $participation = $this->participant($campaign, 'Eva Rastro');
        BarterShipment::query()->create([
            'campaign_creator_id' => $participation->id,
            'method' => 'correios',
            'tracking_code' => 'OY739642509BR',
            'status' => BarterShipmentStatus::InTransit,
        ]);

        $this->artisan('barter:sync-tracking')->assertSuccessful();
        $this->artisan('barter:sync-tracking')->assertSuccessful();

        $shipment = BarterShipment::query()->first();
        $this->assertNotNull($shipment);
        $this->assertSame(BarterShipmentStatus::Delivered, $shipment->status);
        $this->assertNotNull($shipment->notified_delivered_at);
        $this->assertSame(1, MailMessage::query()->where('template_key', MailTemplateKey::BarterDelivered)->count());
        Http::assertSentCount(1);

        $this->asUser($user)
            ->getJson('/api/campaigns')
            ->assertOk()
            ->assertJsonPath('data.0.barter_delivered_count', 1)
            ->assertJsonPath('data.0.applications.0.barter_shipment.status', 'delivered');

        $this->asUser($user)
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertOk()
            ->assertJsonPath('data.barter_delivered_count', 1)
            ->assertJsonPath('data.applications.0.barter_shipment.status', 'delivered');
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

    private function participant(Campaign $campaign, string $name): CampaignCreator
    {
        $creator = Creator::factory()->active()->create([
            'full_name' => $name,
            'artistic_name' => $name,
        ]);

        return CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function trackingPayload(): array
    {
        return [
            'codigo' => 'OY739642509BR',
            'sucesso' => true,
            'servico' => ['sigla' => 'OY', 'descricao' => 'SEDEX (Express)'],
            'status' => 'ENTREGUE',
            'descricaoStatus' => 'Objeto entregue ao destinatário',
            'entregue' => true,
            'diasEmTransito' => 4,
            'dataPostagem' => '2026-08-28T17:01:11.000Z',
            'dataEntrega' => '2026-09-01T12:49:28.000Z',
            'eventos' => [[
                'data' => '2026-09-01T12:49:28.000Z',
                'status' => 'Objeto entregue ao destinatário',
                'categoria' => 'ENTREGUE',
            ]],
        ];
    }
}
