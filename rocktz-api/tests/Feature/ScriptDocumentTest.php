<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\ApprovalFlowType;
use App\Enums\CampaignStatus;
use App\Enums\ContentType;
use App\Enums\StageApprovalStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\ContentPlanningItem;
use App\Models\RecurringContract;
use App\Models\User;
use App\Support\MediaKind;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ScriptDocumentTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_upload_pdf_script(): void
    {
        Storage::fake('uploads');

        $user = User::factory()->admin()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $response = $this->withToken($token)->post('/api/media', [
            'file' => UploadedFile::fake()->create('roteiro.pdf', 128, 'application/pdf'),
        ]);

        $response->assertCreated();
        $this->assertStringStartsWith('document-', (string) $response->json('data.filename'));
        $this->assertStringContainsString('/downloads/', (string) $response->json('data.url'));
    }

    public function test_executable_upload_is_rejected(): void
    {
        Storage::fake('uploads');

        $user = User::factory()->admin()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)->post('/api/media', [
            'file' => UploadedFile::fake()->create('malware.exe', 32, 'application/x-msdownload'),
        ])->assertStatus(422);
    }

    public function test_campaign_briefing_stores_script_file(): void
    {
        $campaign = Campaign::factory()->create([
            'status' => CampaignStatus::Briefing,
        ]);
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson("/api/campaigns/{$campaign->id}", [
                'briefing' => [
                    'product' => 'Sérum',
                    'script_file_url' => 'https://example.com/downloads/document-roteiro.pdf',
                    'script_file_name' => 'roteiro.pdf',
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.briefing.script_file_name', 'roteiro.pdf');
    }

    public function test_creator_can_submit_campaign_script_file(): void
    {
        $campaign = Campaign::factory()->create([
            'status' => CampaignStatus::Production,
            'approval_flow' => ApprovalFlowType::ScriptAndVideo,
        ]);
        $creator = \App\Models\Creator::factory()->active()->create();
        $row = CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'application_status' => ApplicationStatus::Approved,
        ]);
        $token = $creator->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'script_file_url' => 'https://example.com/downloads/document-script.pdf',
                'script_file_name' => 'meu-roteiro.pdf',
                'script_status' => StageApprovalStatus::Submitted->value,
                'delivery_status' => 'sent',
            ])
            ->assertOk()
            ->assertJsonPath('data.content.script_file_name', 'meu-roteiro.pdf');
    }

    public function test_live_pauta_can_include_script_and_file(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $ana = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $contract = RecurringContract::query()->where('title', 'Conteúdo mensal Aurora + Ana')->firstOrFail();
        $token = $admin->createToken('auth')->plainTextToken;

        $created = $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/items", [
                'creator_id' => $ana->creator->id,
                'month' => now()->format('Y-m'),
                'content_type' => ContentType::LiveInstagram->value,
                'title' => 'Live de lançamento',
                'planned_date' => now()->toDateString(),
                'script' => 'Abertura, benefícios, Q&A',
                'pauta_script_file_url' => 'https://example.com/downloads/document-live.pdf',
                'pauta_script_file_name' => 'pauta-live.pdf',
                'briefing_fields' => [
                    'product' => 'Sérum Aurora',
                ],
            ])
            ->assertCreated();

        $this->assertSame('Abertura, benefícios, Q&A', $created->json('data.script'));
        $this->assertSame('pauta-live.pdf', $created->json('data.pauta_script_file_name'));
        $this->assertSame('live_link', $created->json('data.approval_flow'));
    }

    public function test_creator_can_submit_planning_script_file(): void
    {
        $this->seed();

        $ana = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $item = ContentPlanningItem::factory()->planned()->create([
            'creator_id' => $ana->creator->id,
            'company_id' => RecurringContract::query()->where('title', 'Conteúdo mensal Aurora + Ana')->firstOrFail()->company_id,
            'recurring_contract_id' => RecurringContract::query()->where('title', 'Conteúdo mensal Aurora + Ana')->value('id'),
            'briefing' => 'Fale do produto',
            'approval_flow' => ApprovalFlowType::ScriptAndVideo,
        ]);
        $token = $ana->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'script_file_url' => 'https://example.com/downloads/document-script.pdf',
                'script_file_name' => 'roteiro-criador.pdf',
                'script_status' => StageApprovalStatus::Submitted->value,
                'status' => 'review',
            ])
            ->assertOk()
            ->assertJsonPath('data.script_file_name', 'roteiro-criador.pdf');
    }

    public function test_media_kind_detects_docx_zip_mime(): void
    {
        $this->assertSame('document', MediaKind::detect('application/zip', '', 'docx'));
        $this->assertSame('document', MediaKind::detect('application/pdf', 'application/pdf', 'pdf'));
        $this->assertNull(MediaKind::detect('application/zip', '', 'zip'));
    }
}
