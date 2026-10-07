<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\ShippingSender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShippingLabelTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_saves_sender_and_reuses_only_its_own_addresses(): void
    {
        [$company, $user] = $this->companyUser();
        $otherCompany = Company::factory()->active()->create();
        $otherUser = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $otherUser->id,
            'company_id' => $otherCompany->id,
        ]);
        $admin = User::factory()->admin()->create();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => true,
            'name' => 'Kit Verao',
        ]);

        $this->asUser($admin)
            ->putJson("/api/campaigns/{$campaign->id}/shipping-sender", $this->senderPayload('Agencia Central'))
            ->assertOk()
            ->assertJsonPath('data.shipping_sender.name', 'Agencia Central');

        $this->asUser($user)
            ->getJson('/api/shipping-senders')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->asUser($user)
            ->putJson("/api/campaigns/{$campaign->id}/shipping-sender", $this->senderPayload('Loja Aurora'))
            ->assertOk()
            ->assertJsonPath('data.shipping_sender.name', 'Loja Aurora')
            ->assertJsonPath('data.shipping_sender.address.street', 'Rua Augusta')
            ->assertJsonPath('data.shipping_sender.address.zip', '01305000');

        $this->asUser($user)
            ->putJson("/api/campaigns/{$campaign->id}/shipping-sender", $this->senderPayload('Loja Aurora'))
            ->assertOk();

        $this->assertSame(1, ShippingSender::query()->where('company_id', $company->id)->count());
        $this->assertSame(1, ShippingSender::query()->whereNull('company_id')->count());

        $ownId = ShippingSender::query()->where('company_id', $company->id)->value('id');
        $agencyId = ShippingSender::query()->whereNull('company_id')->value('id');

        $this->asUser($user)
            ->getJson('/api/shipping-senders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Loja Aurora');

        $this->asUser($admin)
            ->getJson('/api/shipping-senders')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->asUser($otherUser)
            ->getJson('/api/shipping-senders')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->asUser($otherUser)
            ->putJson("/api/campaigns/{$campaign->id}/shipping-sender", [
                ...$this->senderPayload('Outra Loja'),
                'shipping_sender_id' => $ownId,
            ])
            ->assertForbidden();

        $this->asUser($user)
            ->putJson("/api/campaigns/{$campaign->id}/shipping-sender", [
                ...$this->senderPayload('Loja Aurora'),
                'shipping_sender_id' => $agencyId,
            ])
            ->assertForbidden();
    }

    public function test_downloads_pdf_and_csv_for_approved_barter_creators(): void
    {
        [$company, $user] = $this->companyUser();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => true,
            'name' => 'Kit Verao',
        ]);
        $this->participant($campaign, 'Ana Silva', 'anasilva');
        $this->participant($campaign, 'Bruno Costa', 'brunocosta');
        $this->participant($campaign, 'Carla Dias', 'carladias');
        $this->participant($campaign, 'Sem Endereco', 'semendereco', [
            'shipping_address' => null,
        ]);
        CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => Creator::factory()->active()->create(['full_name' => 'Pendente Fora'])->id,
            'application_status' => ApplicationStatus::Pending,
        ]);

        $this->asUser($user)
            ->get('/api/campaigns/'.$campaign->id.'/shipping-labels?format=pdf')
            ->assertStatus(422);

        $this->asUser($user)
            ->putJson("/api/campaigns/{$campaign->id}/shipping-sender", $this->senderPayload('Loja Aurora'))
            ->assertOk();

        $pdf = $this->asUser($user)
            ->get('/api/campaigns/'.$campaign->id.'/shipping-labels?format=pdf')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $body = $pdf->getContent();
        $this->assertStringStartsWith('%PDF-1.4', $body);
        $this->assertSame(2, preg_match_all('/\/Type \/Page[^s]/', $body));
        $this->assertStringContainsString('Ana Silva', $body);
        $this->assertStringContainsString('Bruno Costa', $body);
        $this->assertStringContainsString('Carla Dias', $body);
        $this->assertStringContainsString('Loja Aurora', $body);
        $this->assertStringContainsString('Avenida Paulista', $body);
        $this->assertStringNotContainsString('Sem Endereco', $body);
        $this->assertStringNotContainsString('Pendente Fora', $body);

        $csv = $this->asUser($user)
            ->get('/api/campaigns/'.$campaign->id.'/shipping-labels?format=csv')
            ->assertOk();

        $text = $csv->getContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $text);
        $this->assertStringContainsString('destinatario_nome', $text);
        $this->assertStringContainsString('remetente_nome', $text);
        $this->assertStringContainsString('Ana Silva', $text);
        $this->assertStringContainsString('Sem Endereco', $text);
        $this->assertStringContainsString('01310-100', $text);
        $this->assertStringContainsString('Loja Aurora', $text);
        $this->assertStringNotContainsString('Pendente Fora', $text);
        $this->assertStringContainsString(';', $text);
    }

    public function test_labels_are_limited_to_barter_campaigns_and_managers(): void
    {
        [$company, $user] = $this->companyUser();
        $paid = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => false,
        ]);
        $creator = Creator::factory()->active()->create();

        $this->asUser($user)
            ->putJson("/api/campaigns/{$paid->id}/shipping-sender", $this->senderPayload('Loja Aurora'))
            ->assertStatus(422);

        $this->asUser($creator->user)
            ->getJson('/api/shipping-senders')
            ->assertForbidden();
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

    /**
     * @return array<string, mixed>
     */
    private function senderPayload(string $name): array
    {
        return [
            'name' => $name,
            'phone' => '11999990000',
            'address' => [
                'country' => 'BR',
                'zip' => '01305-000',
                'street' => 'Rua Augusta',
                'number' => '200',
                'complement' => 'Sala 4',
                'neighborhood' => 'Consolacao',
                'city' => 'Sao Paulo',
                'state' => 'SP',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $creatorAttrs
     */
    private function participant(Campaign $campaign, string $name, string $handle, array $creatorAttrs = []): CampaignCreator
    {
        $creator = Creator::factory()->active()->create([
            'full_name' => $name,
            'artistic_name' => $handle,
            'shipping_address' => [
                'country' => 'BR',
                'zip' => '01310100',
                'street' => 'Avenida Paulista',
                'number' => '1000',
                'complement' => null,
                'neighborhood' => 'Bela Vista',
                'city' => 'Sao Paulo',
                'state' => 'SP',
            ],
            ...$creatorAttrs,
        ]);

        return CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
        ]);
    }
}
