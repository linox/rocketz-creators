<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\MailMessageStatus;
use App\Enums\MailTemplateKey;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\MailMessage;
use App\Models\Notification;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConversationTest extends TestCase
{
    use RefreshDatabase;

    public function test_creator_and_company_exchange_mail_only_on_a_shared_campaign(): void
    {
        $campaign = Campaign::factory()->create(['name' => 'Lançamento de verão']);
        $member = $this->companyUser($campaign->company);
        $otherCompany = Company::factory()->active()->create();
        $outsiderCompany = $this->companyUser($otherCompany);
        $creator = Creator::factory()->active()->create([
            'invited_by_company_id' => $campaign->company_id,
        ]);
        $this->approveOnCampaign($campaign, $creator);
        $also = Creator::factory()->active()->create();
        $this->approveOnCampaign($campaign, $also);
        $poolOnly = Creator::factory()->active()->create([
            'invited_by_company_id' => $campaign->company_id,
        ]);

        $created = $this->asUser($creator->user)
            ->postJson('/api/conversations', [
                'subject' => 'Dúvida sobre a entrega',
                'body' => "Oi, posso postar amanhã?\nObrigado.",
                'campaign_id' => $campaign->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.subject', 'Dúvida sobre a entrega')
            ->assertJsonPath('data.parties.company.name', $campaign->company->name)
            ->assertJsonPath('data.parties.creator.id', $creator->id)
            ->assertJsonPath('data.parties.agency', true)
            ->assertJsonPath('data.work.kind', 'campaign')
            ->assertJsonPath('data.work.name', 'Lançamento de verão')
            ->assertJsonPath('data.unread', false);

        $id = (int) $created->json('data.id');
        $this->assertSame("Oi, posso postar amanhã?\nObrigado.", $created->json('data.messages.0.body'));

        $this->asUser($poolOnly->user)
            ->postJson('/api/conversations', [
                'subject' => 'Não deveria',
                'body' => 'Oi',
                'campaign_id' => $campaign->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.campaign_id.0', __('messages.work_not_allowed'));

        $this->asUser($creator->user)
            ->postJson('/api/conversations', [
                'subject' => 'Sem trabalho',
                'body' => 'Oi',
                'with_agency' => true,
            ])
            ->assertStatus(422);

        $this->asUser($member)
            ->getJson('/api/nav')
            ->assertOk()
            ->assertJsonPath('message_unread', 1);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $member->id,
            'link' => '/messages?c='.$id,
            'read' => false,
        ]);

        $this->asUser($outsiderCompany)
            ->getJson("/api/conversations/{$id}")
            ->assertForbidden();

        $this->asUser($member)
            ->getJson('/api/conversations')
            ->assertOk()
            ->assertJsonPath('meta.unread', 1)
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.unread', true)
            ->assertJsonCount(1, 'data.0.participants')
            ->assertJsonPath('data.0.participants.0.name', $creator->artistic_name);

        $this->asUser($member)
            ->getJson("/api/conversations/{$id}")
            ->assertOk()
            ->assertJsonPath('data.unread', false);

        $this->asUser($member)
            ->getJson('/api/nav')
            ->assertOk()
            ->assertJsonPath('message_unread', 0);

        $this->assertTrue(
            Notification::query()->where('user_id', $member->id)->where('link', '/messages?c='.$id)->first()?->read,
        );

        $this->asUser($member)
            ->postJson("/api/conversations/{$id}/messages", ['body' => 'Pode postar amanhã.'])
            ->assertOk()
            ->assertJsonPath('data.messages.1.body', 'Pode postar amanhã.')
            ->assertJsonPath('data.messages.1.mine', true)
            ->assertJsonCount(2, 'data.participants')
            ->assertJsonPath('data.participants.0.name', $creator->artistic_name)
            ->assertJsonPath('data.participants.0.photo_url', $creator->photo_url)
            ->assertJsonPath('data.participants.1.id', $member->id);

        $this->asUser($creator->user)
            ->getJson('/api/nav')
            ->assertOk()
            ->assertJsonPath('message_unread', 1);

        $this->asUser($also->user)
            ->getJson("/api/conversations/{$id}")
            ->assertForbidden();
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $also->user->id,
            'link' => '/messages?c='.$id,
        ]);

        $admin = User::factory()->admin()->create();
        $this->asUser($admin)
            ->getJson('/api/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.id', $id);
    }

    public function test_agency_monitors_the_work_and_replies_for_the_company(): void
    {
        $campaign = Campaign::factory()->create();
        $creator = Creator::factory()->active()->create();
        $this->approveOnCampaign($campaign, $creator);
        $admin = User::factory()->admin()->create();
        $member = $this->companyUser($campaign->company);

        $created = $this->asUser($creator->user)
            ->postJson('/api/conversations', [
                'subject' => 'Quero falar com a agência',
                'body' => 'Preciso de ajuda nesta campanha.',
                'campaign_id' => $campaign->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.parties.agency', true)
            ->assertJsonPath('data.parties.company.id', $campaign->company_id)
            ->assertJsonPath('data.work.id', $campaign->id);

        $id = (int) $created->json('data.id');

        $this->asUser($admin)
            ->getJson('/api/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.unread', true);

        $this->asUser($member)
            ->getJson("/api/conversations/{$id}")
            ->assertOk();

        $this->asUser($admin)
            ->postJson("/api/conversations/{$id}/messages", ['body' => 'Já estou vendo.'])
            ->assertOk();

        $this->asUser($creator->user)
            ->getJson("/api/conversations/{$id}")
            ->assertOk()
            ->assertJsonPath('data.messages.1.author.side', 'company')
            ->assertJsonCount(2, 'data.participants')
            ->assertJsonPath('data.participants.0.name', $creator->artistic_name)
            ->assertJsonPath('data.participants.1.id', $admin->id);
    }

    public function test_agency_only_includes_a_creator_who_is_approved_on_the_campaign(): void
    {
        $campaign = Campaign::factory()->create();
        $creator = Creator::factory()->active()->create();
        $pending = Creator::factory()->active()->create();
        $this->approveOnCampaign($campaign, $creator);
        CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $pending->id,
            'application_status' => ApplicationStatus::Pending,
        ]);
        $member = $this->companyUser($campaign->company);
        $admin = User::factory()->admin()->create();

        $this->asUser($pending->user)
            ->postJson('/api/conversations', [
                'subject' => 'Ainda não',
                'body' => 'Oi',
                'campaign_id' => $campaign->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.campaign_id.0', __('messages.work_not_allowed'));

        $this->asUser($admin)
            ->postJson('/api/conversations', [
                'subject' => 'Alinhar a campanha',
                'body' => 'Vamos incluir o criador.',
                'campaign_id' => $campaign->id,
                'creator_id' => $pending->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.creator_id.0', __('messages.creator_not_on_work'));

        $created = $this->asUser($admin)
            ->postJson('/api/conversations', [
                'subject' => 'Alinhar a campanha',
                'body' => 'Vamos incluir o criador.',
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.parties.agency', true)
            ->assertJsonPath('data.parties.creator.id', $creator->id)
            ->assertJsonPath('data.parties.company.id', $campaign->company_id);

        $id = (int) $created->json('data.id');

        $this->asUser($member)->getJson("/api/conversations/{$id}")->assertOk();
        $this->asUser($creator->user)->getJson("/api/conversations/{$id}")->assertOk();
        $this->asUser($pending->user)->getJson("/api/conversations/{$id}")->assertForbidden();

        $works = $this->asUser($creator->user)
            ->getJson('/api/conversations/recipients')
            ->assertOk()
            ->json('data.works');

        $this->assertTrue(collect($works)->contains(fn ($row) => $row['kind'] === 'campaign' && (int) $row['id'] === $campaign->id));
    }

    public function test_company_can_message_only_creators_assigned_to_a_recurring_job(): void
    {
        $contract = RecurringContract::factory()->create(['title' => 'Embaixadores']);
        $member = $this->companyUser($contract->company);
        $assigned = Creator::factory()->active()->create(['artistic_name' => 'Lia Luz']);
        $poolOnly = Creator::factory()->active()->create([
            'invited_by_company_id' => $contract->company_id,
            'artistic_name' => 'Fora da Lista',
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $contract->id,
            'creator_id' => $assigned->id,
        ]);

        $works = $this->asUser($member)
            ->getJson('/api/conversations/recipients?q=Embaixadores')
            ->assertOk()
            ->json('data.works');

        $match = collect($works)->first(fn ($row) => $row['kind'] === 'recurring' && (int) $row['id'] === $contract->id);
        $this->assertNotNull($match);
        $this->assertTrue(collect($match['creators'])->contains(fn ($row) => (int) $row['id'] === $assigned->id && $row['name'] === 'Lia Luz'));
        $this->assertFalse(collect($match['creators'])->contains(fn ($row) => (int) $row['id'] === $poolOnly->id));

        $this->asUser($member)
            ->postJson('/api/conversations', [
                'subject' => 'Pauta do mês',
                'body' => 'Vamos fechar os temas.',
                'recurring_contract_id' => $contract->id,
                'creator_id' => $poolOnly->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.creator_id.0', __('messages.creator_not_on_work'));

        $created = $this->asUser($member)
            ->postJson('/api/conversations', [
                'subject' => 'Pauta do mês',
                'body' => 'Vamos fechar os temas.',
                'recurring_contract_id' => $contract->id,
                'creator_id' => $assigned->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.work.kind', 'recurring')
            ->assertJsonPath('data.work.name', 'Embaixadores')
            ->assertJsonPath('data.parties.creator.name', 'Lia Luz')
            ->assertJsonPath('data.parties.agency', true);

        $id = (int) $created->json('data.id');
        $this->asUser($assigned->user)->getJson("/api/conversations/{$id}")->assertOk();
        $this->asUser($poolOnly->user)->getJson("/api/conversations/{$id}")->assertForbidden();

        $this->asUser($assigned->user)
            ->getJson('/api/conversations/recipients')
            ->assertOk()
            ->assertJsonPath('data.works.0.kind', 'recurring')
            ->assertJsonPath('data.works.0.id', $contract->id);
    }

    public function test_opening_message_notifies_the_creator_or_the_company_and_agency(): void
    {
        $campaign = Campaign::factory()->create();
        $creator = Creator::factory()->active()->create();
        $this->approveOnCampaign($campaign, $creator);
        $member = $this->companyUser($campaign->company);
        $otherMember = $this->companyUser($campaign->company);
        $admin = User::factory()->admin()->create();

        $fromCreator = $this->asUser($creator->user)
            ->postJson('/api/conversations', [
                'subject' => 'Para a Creatorz',
                'body' => 'Preciso de um retorno.',
                'campaign_id' => $campaign->id,
            ])
            ->assertCreated();
        $creatorThread = (int) $fromCreator->json('data.id');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $member->id,
            'link' => '/messages?c='.$creatorThread,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $otherMember->id,
            'link' => '/messages?c='.$creatorThread,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'link' => '/messages?c='.$creatorThread,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $creator->user->id,
            'link' => '/messages?c='.$creatorThread,
        ]);
        foreach ([$member, $otherMember, $admin] as $recipient) {
            $this->assertDatabaseHas('mail_messages', [
                'user_id' => $recipient->id,
                'template_key' => MailTemplateKey::ConversationStarted->value,
                'related_id' => $creatorThread,
                'status' => MailMessageStatus::Sent->value,
            ]);
        }
        $this->assertDatabaseMissing('mail_messages', [
            'user_id' => $creator->user->id,
            'template_key' => MailTemplateKey::ConversationStarted->value,
        ]);

        $fromCompany = $this->asUser($member)
            ->postJson('/api/conversations', [
                'subject' => 'Para o criador',
                'body' => 'Vamos alinhar a entrega.',
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
            ])
            ->assertCreated();
        $companyThread = (int) $fromCompany->json('data.id');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $creator->user->id,
            'link' => '/messages?c='.$companyThread,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $otherMember->id,
            'link' => '/messages?c='.$companyThread,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $admin->id,
            'link' => '/messages?c='.$companyThread,
        ]);
        $this->assertDatabaseHas('mail_messages', [
            'user_id' => $creator->user->id,
            'template_key' => MailTemplateKey::ConversationStarted->value,
            'related_id' => $companyThread,
            'status' => MailMessageStatus::Sent->value,
        ]);
        $this->assertDatabaseMissing('mail_messages', [
            'user_id' => $otherMember->id,
            'related_id' => $companyThread,
        ]);
        $this->assertDatabaseMissing('mail_messages', [
            'user_id' => $admin->id,
            'related_id' => $companyThread,
        ]);

        $mailed = MailMessage::query()->where('template_key', MailTemplateKey::ConversationStarted)->count();
        $this->asUser($creator->user)
            ->postJson('/api/conversations/'.$companyThread.'/messages', [
                'body' => 'Recebi, obrigado.',
            ])
            ->assertOk();
        $this->assertSame($mailed, MailMessage::query()->where('template_key', MailTemplateKey::ConversationStarted)->count());
        foreach ([$member, $otherMember, $admin] as $recipient) {
            $this->assertDatabaseHas('mail_messages', [
                'user_id' => $recipient->id,
                'template_key' => MailTemplateKey::ConversationReplied->value,
                'related_id' => $companyThread,
                'status' => MailMessageStatus::Sent->value,
            ]);
        }
        $this->assertDatabaseMissing('mail_messages', [
            'user_id' => $creator->user->id,
            'template_key' => MailTemplateKey::ConversationReplied->value,
            'related_id' => $companyThread,
        ]);
    }

    public function test_company_or_agency_can_close_a_conversation(): void
    {
        $campaign = Campaign::factory()->create();
        $creator = Creator::factory()->active()->create();
        $this->approveOnCampaign($campaign, $creator);
        $member = $this->companyUser($campaign->company);
        $admin = User::factory()->admin()->create();

        $created = $this->asUser($creator->user)
            ->postJson('/api/conversations', [
                'subject' => 'Dúvida final',
                'body' => 'Podemos encerrar depois da resposta.',
                'campaign_id' => $campaign->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.closed', false);

        $id = (int) $created->json('data.id');

        $this->asUser($creator->user)
            ->postJson("/api/conversations/{$id}/close", ['reason' => 'resolved'])
            ->assertForbidden();

        $this->asUser($member)
            ->postJson("/api/conversations/{$id}/close", [])
            ->assertStatus(422);

        $this->asUser($member)
            ->postJson("/api/conversations/{$id}/close", ['reason' => 'resolved'])
            ->assertOk()
            ->assertJsonPath('data.closed', true)
            ->assertJsonPath('data.close_reason', 'resolved');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $creator->user->id,
            'link' => '/messages?c='.$id,
            'message' => __('messages.conversation_closed_notice').' '.__('messages.close_reasons.resolved'),
        ]);
        $this->assertDatabaseHas('mail_messages', [
            'user_id' => $creator->user->id,
            'template_key' => MailTemplateKey::ConversationClosed->value,
            'related_id' => $id,
            'status' => MailMessageStatus::Sent->value,
        ]);
        $this->assertDatabaseMissing('mail_messages', [
            'user_id' => $member->id,
            'template_key' => MailTemplateKey::ConversationClosed->value,
        ]);

        $this->asUser($creator->user)
            ->postJson("/api/conversations/{$id}/messages", ['body' => 'Mais uma dúvida'])
            ->assertStatus(422)
            ->assertJsonPath('errors.body.0', __('messages.conversation_closed'));

        $this->asUser($admin)
            ->postJson("/api/conversations/{$id}/close", ['reason' => 'duplicate'])
            ->assertStatus(422)
            ->assertJsonPath('errors.conversation.0', __('messages.conversation_already_closed'));

        $again = $this->asUser($creator->user)
            ->postJson('/api/conversations', [
                'subject' => 'Outro assunto',
                'body' => 'A agência pode encerrar.',
                'campaign_id' => $campaign->id,
            ])
            ->assertCreated();

        $againId = (int) $again->json('data.id');
        $this->asUser($admin)
            ->postJson('/api/conversations/'.$againId.'/close', ['reason' => 'other'])
            ->assertOk()
            ->assertJsonPath('data.closed', true)
            ->assertJsonPath('data.close_reason', 'other');
        $this->assertDatabaseHas('mail_messages', [
            'user_id' => $creator->user->id,
            'template_key' => MailTemplateKey::ConversationClosed->value,
            'related_id' => $againId,
            'status' => MailMessageStatus::Sent->value,
        ]);
        $this->assertDatabaseMissing('mail_messages', [
            'user_id' => $admin->id,
            'template_key' => MailTemplateKey::ConversationClosed->value,
        ]);
    }

    public function test_another_reply_emails_again_only_after_twelve_hours(): void
    {
        $campaign = Campaign::factory()->create();
        $creator = Creator::factory()->active()->create();
        $this->approveOnCampaign($campaign, $creator);
        $member = $this->companyUser($campaign->company);

        $created = $this->asUser($member)
            ->postJson('/api/conversations', [
                'subject' => 'Retorno',
                'body' => 'Primeira mensagem.',
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
            ])
            ->assertCreated();
        $id = (int) $created->json('data.id');

        $this->asUser($creator->user)
            ->postJson("/api/conversations/{$id}/messages", ['body' => 'Primeira resposta.'])
            ->assertOk();

        $replies = MailMessage::query()
            ->where('template_key', MailTemplateKey::ConversationReplied)
            ->where('related_id', $id)
            ->count();
        $this->assertGreaterThan(0, $replies);

        $this->asUser($member)
            ->postJson("/api/conversations/{$id}/messages", ['body' => 'Resposta logo em seguida.'])
            ->assertOk();
        $this->assertSame($replies, MailMessage::query()->where('template_key', MailTemplateKey::ConversationReplied)->where('related_id', $id)->count());

        $this->travelTo(now()->addHours(12)->addMinute());

        $this->asUser($member)
            ->postJson("/api/conversations/{$id}/messages", ['body' => 'Resposta depois de 12 horas.'])
            ->assertOk();

        $this->assertDatabaseHas('mail_messages', [
            'user_id' => $creator->user->id,
            'template_key' => MailTemplateKey::ConversationReplied->value,
            'related_id' => $id,
            'status' => MailMessageStatus::Sent->value,
        ]);
        $this->assertGreaterThan($replies, MailMessage::query()->where('template_key', MailTemplateKey::ConversationReplied)->where('related_id', $id)->count());
    }

    public function test_company_and_agency_reply_with_a_chat_nickname(): void
    {
        $campaign = Campaign::factory()->create();
        $creator = Creator::factory()->active()->create();
        $this->approveOnCampaign($campaign, $creator);
        $member = $this->companyUser($campaign->company);
        $admin = User::factory()->admin()->create();

        $this->asUser($creator->user)
            ->patchJson('/api/auth/me/chat-identity', [
                'chat_name' => 'Ana do chat',
                'chat_avatar_url' => 'https://cdn.example.com/ana.jpg',
            ])
            ->assertForbidden();

        $this->asUser($member)
            ->patchJson('/api/auth/me/chat-identity', [
                'chat_name' => 'Time Aurora',
                'chat_avatar_url' => 'https://cdn.example.com/aurora.jpg',
            ])
            ->assertOk()
            ->assertJsonPath('user.chat_name', 'Time Aurora')
            ->assertJsonPath('user.chat_avatar_url', 'https://cdn.example.com/aurora.jpg');

        $created = $this->asUser($member)
            ->postJson('/api/conversations', [
                'subject' => 'Com apelido',
                'body' => 'Oi, aqui é o time.',
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
            ])
            ->assertCreated();
        $id = (int) $created->json('data.id');

        $this->asUser($admin)
            ->patchJson('/api/auth/me/chat-identity', [
                'chat_name' => 'Equipe Creatorz',
                'chat_avatar_url' => 'https://cdn.example.com/agency.jpg',
            ])
            ->assertOk();

        $this->asUser($admin)
            ->postJson("/api/conversations/{$id}/messages", ['body' => 'A agência também responde.'])
            ->assertOk();

        $this->asUser($creator->user)
            ->getJson("/api/conversations/{$id}")
            ->assertOk()
            ->assertJsonPath('data.messages.0.author.name', 'Time Aurora')
            ->assertJsonPath('data.messages.0.author.photo_url', 'https://cdn.example.com/aurora.jpg')
            ->assertJsonPath('data.messages.1.author.name', 'Equipe Creatorz')
            ->assertJsonPath('data.messages.1.author.photo_url', 'https://cdn.example.com/agency.jpg')
            ->assertJsonPath('data.participants.1.name', 'Time Aurora')
            ->assertJsonPath('data.participants.2.name', 'Equipe Creatorz');
    }

    public function test_company_and_agency_see_when_their_team_replies(): void
    {
        $campaign = Campaign::factory()->create();
        $member = $this->companyUser($campaign->company);
        $teammate = $this->companyUser($campaign->company);
        $admin = User::factory()->admin()->create();
        $creator = Creator::factory()->active()->create();
        $this->approveOnCampaign($campaign, $creator);

        $created = $this->asUser($member)
            ->postJson('/api/conversations', [
                'subject' => 'Confirma o envio',
                'body' => 'Consegue postar amanhã?',
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
            ])
            ->assertCreated();
        $id = (int) $created->json('data.id');

        $this->assertSame('replied', $this->receiptFor($teammate, $id));
        $this->assertSame('replied', $this->receiptFor($admin, $id));
        $this->asUser($creator->user)
            ->getJson('/api/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.receipt', null);

        $this->asUser($creator->user)
            ->postJson("/api/conversations/{$id}/messages", ['body' => 'Consigo sim.'])
            ->assertOk();
        $this->assertSame('open', $this->receiptFor($member, $id));

        $this->asUser($teammate)->getJson("/api/conversations/{$id}")->assertOk();
        $this->assertSame('opened', $this->receiptFor($member, $id));
        $this->assertSame('opened', $this->receiptFor($admin, $id));

        $this->asUser($admin)
            ->postJson("/api/conversations/{$id}/messages", ['body' => 'A agência confirma.'])
            ->assertOk();
        $this->assertSame('replied', $this->receiptFor($member, $id));
        $this->assertSame('replied', $this->receiptFor($teammate, $id));

        $started = $this->asUser($creator->user)
            ->postJson('/api/conversations', [
                'subject' => 'Dúvida nova',
                'body' => 'Posso mudar o horário?',
                'campaign_id' => $campaign->id,
            ])
            ->assertCreated();
        $this->assertSame('open', $this->receiptFor($member, (int) $started->json('data.id')));
    }

    public function test_agency_filters_campaigns_and_recurring_jobs_by_company(): void
    {
        $alpha = Company::factory()->active()->create(['name' => 'Alpha']);
        $beta = Company::factory()->active()->create(['name' => 'Beta']);
        $alphaCampaign = Campaign::factory()->create(['company_id' => $alpha->id, 'name' => 'Campanha Alpha']);
        $betaCampaign = Campaign::factory()->create(['company_id' => $beta->id, 'name' => 'Campanha Beta']);
        $alphaContract = RecurringContract::factory()->create(['company_id' => $alpha->id, 'title' => 'Recorrente Alpha']);
        $admin = User::factory()->admin()->create();
        $member = $this->companyUser($alpha);

        $open = $this->asUser($admin)->getJson('/api/conversations/recipients')->assertOk();
        $open->assertJsonPath('data.works', []);
        $names = collect($open->json('data.companies'))->pluck('name');
        $this->assertTrue($names->contains('Alpha'));
        $this->assertTrue($names->contains('Beta'));

        $filtered = collect($this->asUser($admin)
            ->getJson('/api/conversations/recipients?company_id='.$alpha->id.'&q=Alpha')
            ->assertOk()
            ->json('data.works'));

        $this->assertTrue($filtered->contains(fn ($row) => $row['kind'] === 'campaign' && (int) $row['id'] === $alphaCampaign->id));
        $this->assertTrue($filtered->contains(fn ($row) => $row['kind'] === 'recurring' && (int) $row['id'] === $alphaContract->id));
        $this->assertFalse($filtered->contains(fn ($row) => $row['kind'] === 'campaign' && (int) $row['id'] === $betaCampaign->id));

        $companyWorks = collect($this->asUser($member)
            ->getJson('/api/conversations/recipients?company_id='.$beta->id)
            ->assertOk()
            ->json('data.works'));

        $this->assertTrue($companyWorks->contains(fn ($row) => $row['kind'] === 'campaign' && (int) $row['id'] === $alphaCampaign->id));
        $this->assertFalse($companyWorks->contains(fn ($row) => $row['kind'] === 'campaign' && (int) $row['id'] === $betaCampaign->id));
        $this->assertSame([], $this->asUser($member)->getJson('/api/conversations/recipients')->json('data.companies'));
    }

    private function receiptFor(User $user, int $conversationId): ?string
    {
        $row = collect($this->asUser($user)->getJson('/api/conversations')->assertOk()->json('data'))
            ->firstWhere('id', $conversationId);

        return $row['receipt'] ?? null;
    }

    private function approveOnCampaign(Campaign $campaign, Creator $creator): void
    {
        CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'application_status' => ApplicationStatus::Approved,
        ]);
    }

    private function companyUser(Company $company): User
    {
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);

        return $user;
    }

    private function asUser(User $user): static
    {
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('auth')->plainTextToken);
    }
}
