<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Enums\CompanyStatus;
use App\Enums\ConversationCloseReason;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\RecurringContractStatus;
use App\Enums\UserRole;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\ContentPlanningItem;
use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Models\ConversationRead;
use App\Models\Creator;
use App\Models\Notification;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Models\User;
use App\Services\Mail\MailNotifier;
use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ConversationMailbox
{
    private const RECIPIENT_LIMIT = 40;

    public function __construct(
        private NotificationService $notifications,
        private MailNotifier $mail,
    ) {}

    public function visibleQuery(User $user): Builder
    {
        return Conversation::query()->visibleTo($user);
    }

    public function unreadCount(User $user): int
    {
        return $this->visibleQuery($user)
            ->whereExists(function ($query) use ($user) {
                $query->selectRaw('1')
                    ->from('conversation_messages as m')
                    ->whereColumn('m.conversation_id', 'conversations.id')
                    ->whereRaw(
                        'm.id > coalesce((select r.last_read_message_id from conversation_reads r where r.conversation_id = conversations.id and r.user_id = ?), 0)',
                        [$user->id],
                    );
            })
            ->count();
    }

    public function assertCanView(User $user, Conversation $conversation): void
    {
        abort_unless(
            $this->visibleQuery($user)->whereKey($conversation->id)->exists(),
            403,
            __('auth.forbidden'),
        );
    }

    /**
     * @return array{works: list<array<string, mixed>>, companies: list<array{id: int, name: string}>, truncated: bool}
     */
    public function recipients(User $user, ?string $search, ?int $companyId = null): array
    {
        $companyId = $user->role === UserRole::Admin && $companyId ? $companyId : null;
        if ($user->role === UserRole::Admin && ! $companyId) {
            return [
                'works' => [],
                'companies' => $this->agencyCompanies(),
                'truncated' => false,
            ];
        }

        $result = $this->worksFor($user, $this->term($search), $companyId);
        $result['companies'] = $user->role === UserRole::Admin ? $this->agencyCompanies() : [];

        return $result;
    }

    /**
     * @param  array{subject: string, body: string, campaign_id?: int|null, recurring_contract_id?: int|null}  $input
     */
    public function start(User $user, array $input): Conversation
    {
        $subject = $this->requiredText($input['subject'] ?? '', 'subject', 'messages.subject_required', 160);
        $body = $this->requiredText($input['body'] ?? '', 'body', 'messages.body_required', 5000);
        $parties = $this->partiesFor($user, $input);

        $conversation = DB::transaction(function () use ($user, $subject, $body, $parties) {
            $conversation = Conversation::query()->create([
                'subject' => $subject,
                'company_id' => $parties['company_id'],
                'creator_id' => $parties['creator_id'],
                'campaign_id' => $parties['campaign_id'],
                'recurring_contract_id' => $parties['recurring_contract_id'],
                'with_agency' => $parties['with_agency'],
                'created_by' => $user->id,
                'last_message_at' => now(),
            ]);
            $message = $conversation->messages()->create([
                'user_id' => $user->id,
                'body' => $body,
            ]);
            $this->rememberRead($user, $conversation, (int) $message->id);

            return $conversation;
        });

        $message = $conversation->messages()->latest('id')->first();
        if ($message) {
            $preview = Str::limit(trim((string) preg_replace('/\s+/', ' ', $message->body)), 180);
            $this->notifyAudience($conversation, $user, $preview);
            $this->mail->conversationStarted($conversation, $user, $preview);
        }

        return $conversation;
    }

    public function close(User $user, Conversation $conversation, string $reason): Conversation
    {
        $this->assertCanView($user, $conversation);
        abort_unless(
            $user->role === UserRole::Admin || $user->role === UserRole::Company,
            403,
            __('auth.forbidden'),
        );

        $parsed = ConversationCloseReason::tryFrom($reason);
        if (! $parsed) {
            throw ValidationException::withMessages([
                'reason' => [__('messages.close_reason_required')],
            ]);
        }

        if ($conversation->closed_at) {
            throw ValidationException::withMessages([
                'conversation' => [__('messages.conversation_already_closed')],
            ]);
        }

        $conversation->forceFill([
            'closed_at' => now(),
            'close_reason' => $parsed,
        ])->save();
        $this->notifyAudience(
            $conversation,
            $user,
            __('messages.conversation_closed_notice').' '.__('messages.close_reasons.'.$parsed->value),
        );
        $this->mail->conversationClosed($conversation, $user, $parsed->value);

        return $conversation;
    }

    public function reply(User $user, Conversation $conversation, string $body): ConversationMessage
    {
        $this->assertCanView($user, $conversation);
        if ($conversation->closed_at) {
            throw ValidationException::withMessages([
                'body' => [__('messages.conversation_closed')],
            ]);
        }
        $text = $this->requiredText($body, 'body', 'messages.body_required', 5000);

        $message = DB::transaction(function () use ($user, $conversation, $text) {
            $message = $conversation->messages()->create([
                'user_id' => $user->id,
                'body' => $text,
            ]);
            $conversation->forceFill(['last_message_at' => now()])->save();
            $this->rememberRead($user, $conversation, (int) $message->id);

            return $message;
        });

        $preview = Str::limit(trim((string) preg_replace('/\s+/', ' ', $message->body)), 180);
        $this->notifyAudience($conversation, $user, $preview);
        $this->mail->conversationReplied($conversation, $user, $preview);

        return $message;
    }

    public function markRead(User $user, Conversation $conversation): void
    {
        $latestId = (int) $conversation->messages()->max('id');
        $this->rememberRead($user, $conversation, $latestId);
    }

    public function present(Conversation $conversation, User $viewer, bool $withMessages): Conversation
    {
        $conversation->load([
            'company:id,name',
            'creator:id,user_id,artistic_name,full_name,photo_url',
            'campaign:id,name',
            'recurringContract:id,title',
            'latestMessage.user:id,name,role,avatar_url,chat_name,chat_avatar_url',
            'reads' => fn ($query) => $query->where('user_id', $viewer->id),
        ]);

        if ($withMessages) {
            $conversation->load([
                'messages' => fn ($query) => $query->with([
                    'user:id,name,role,avatar_url,chat_name,chat_avatar_url',
                    'user.creator:id,user_id,artistic_name,full_name,photo_url',
                ])->orderByDesc('id')->limit(300),
            ]);
        }

        $readId = (int) ($conversation->reads->first()?->last_read_message_id ?? 0);
        $latestId = (int) ($conversation->latestMessage?->id ?? 0);
        $conversation->setAttribute('unread_for_viewer', $latestId > $readId);
        $this->attachParticipants(collect([$conversation]));

        return $conversation;
    }

    /**
     * @param  Collection<int, Conversation>  $conversations
     */
    public function attachParticipants(Collection $conversations): void
    {
        if ($conversations->isEmpty()) {
            return;
        }

        $rows = ConversationMessage::query()
            ->whereIn('conversation_id', $conversations->pluck('id'))
            ->select('conversation_id', 'user_id')
            ->selectRaw('MIN(id) as first_id')
            ->groupBy('conversation_id', 'user_id')
            ->orderBy('first_id')
            ->get();

        $users = User::query()
            ->whereIn('id', $rows->pluck('user_id')->filter()->unique())
            ->with('creator:id,user_id,artistic_name,full_name,photo_url')
            ->get(['id', 'name', 'role', 'avatar_url', 'chat_name', 'chat_avatar_url'])
            ->keyBy('id');

        $authors = $rows->groupBy('conversation_id');

        foreach ($conversations as $conversation) {
            $people = [];
            $seen = [];
            $creator = $conversation->creator;
            if ($creator) {
                $userId = (int) $creator->user_id;
                $people[] = [
                    'id' => $userId > 0 ? $userId : null,
                    'name' => self::creatorName($creator),
                    'photo_url' => MediaUrl::publicAbsolute($creator->photo_url),
                ];
                if ($userId > 0) {
                    $seen[$userId] = true;
                }
            }

            foreach ($authors->get($conversation->id, collect()) as $row) {
                $userId = (int) $row->user_id;
                if ($userId === 0 || isset($seen[$userId])) {
                    continue;
                }
                $user = $users->get($userId);
                if (! $user) {
                    continue;
                }
                $seen[$userId] = true;
                $people[] = [
                    'id' => $userId,
                    'name' => $user->role === UserRole::Creator ? (self::creatorName($user->creator) ?: $user->name) : $user->chatDisplayName(),
                    'photo_url' => MediaUrl::publicAbsolute($user->chatDisplayPhoto()),
                ];
                if (count($people) >= 8) {
                    break;
                }
            }

            $conversation->setAttribute('participants', $people);
        }
    }

    public static function creatorName(?Creator $creator): string
    {
        if (! $creator) {
            return '';
        }

        $artistic = trim((string) $creator->artistic_name);

        return $artistic !== '' ? $artistic : (string) $creator->full_name;
    }

    /**
     * @param  array{campaign_id?: int|null, recurring_contract_id?: int|null, creator_id?: int|null}  $input
     * @return array{company_id: ?int, creator_id: ?int, campaign_id: ?int, recurring_contract_id: ?int, with_agency: bool}
     */
    private function partiesFor(User $user, array $input): array
    {
        $campaignId = (int) ($input['campaign_id'] ?? 0);
        $recurringId = (int) ($input['recurring_contract_id'] ?? 0);
        if (($campaignId > 0) === ($recurringId > 0)) {
            throw ValidationException::withMessages([
                'campaign_id' => [__('messages.work_required')],
            ]);
        }

        if ($campaignId > 0) {
            $campaign = Campaign::query()->find($campaignId);
            if (! $campaign || ! $this->canUseCampaign($user, $campaign)) {
                throw ValidationException::withMessages([
                    'campaign_id' => [__('messages.work_not_allowed')],
                ]);
            }

            return $this->partiesOnWork($user, (int) $campaign->company_id, $campaignId, null, $input);
        }

        $contract = RecurringContract::query()->find($recurringId);
        if (! $contract || ! $this->canUseRecurring($user, $contract)) {
            throw ValidationException::withMessages([
                'recurring_contract_id' => [__('messages.work_not_allowed')],
            ]);
        }

        return $this->partiesOnWork($user, (int) $contract->company_id, null, $recurringId, $input);
    }

    /**
     * @param  array{creator_id?: int|null}  $input
     * @return array{company_id: ?int, creator_id: ?int, campaign_id: ?int, recurring_contract_id: ?int, with_agency: bool}
     */
    private function partiesOnWork(User $user, int $companyId, ?int $campaignId, ?int $recurringId, array $input): array
    {
        if ($user->role === UserRole::Creator) {
            $creator = $user->creator;
            abort_unless($creator, 403, __('auth.forbidden'));
            $creatorId = (int) $creator->id;
        } else {
            if ($user->role === UserRole::Company) {
                abort_unless((int) $user->actingCompanyId() === $companyId, 403, __('auth.forbidden'));
            }
            $creatorId = (int) ($input['creator_id'] ?? 0);
            if ($creatorId <= 0) {
                throw ValidationException::withMessages([
                    'creator_id' => [__('messages.party_required')],
                ]);
            }
            if (! $this->creatorIsOnWork($creatorId, $campaignId, $recurringId)) {
                throw ValidationException::withMessages([
                    'creator_id' => [__('messages.creator_not_on_work')],
                ]);
            }
        }

        return [
            'company_id' => $companyId,
            'creator_id' => $creatorId,
            'campaign_id' => $campaignId,
            'recurring_contract_id' => $recurringId,
            'with_agency' => true,
        ];
    }

    private function rememberRead(User $user, Conversation $conversation, int $messageId): void
    {
        ConversationRead::query()->updateOrCreate(
            ['conversation_id' => $conversation->id, 'user_id' => $user->id],
            [
                'last_read_message_id' => $messageId > 0 ? $messageId : null,
                'last_read_at' => now(),
            ],
        );

        Notification::query()
            ->where('user_id', $user->id)
            ->where('link', '/messages?c='.$conversation->id)
            ->where('read', false)
            ->update(['read' => true]);
    }

    private function notifyAudience(Conversation $conversation, User $sender, string $preview): void
    {
        if ($sender->role === UserRole::Creator) {
            $this->notifyCompany($conversation, $sender, $preview);
            $this->notifyAgency($sender, $conversation->subject, $preview, '/messages?c='.$conversation->id);

            return;
        }

        $this->notifyCreatorParty($conversation, $sender, $preview);
    }

    private function notifyCreatorParty(Conversation $conversation, User $sender, string $preview): void
    {
        if (! $conversation->creator_id) {
            return;
        }

        $creatorUserId = (int) Creator::query()->whereKey($conversation->creator_id)->value('user_id');
        if ($creatorUserId <= 0 || $creatorUserId === (int) $sender->id) {
            return;
        }

        $this->notifications->notifyCreator((int) $conversation->creator_id, [
            'title' => $conversation->subject,
            'message' => $preview,
            'type' => NotificationType::General,
            'link' => '/messages?c='.$conversation->id,
        ]);
    }

    private function notifyCompany(Conversation $conversation, User $sender, string $preview): void
    {
        if (! $conversation->company_id) {
            return;
        }

        $title = $conversation->subject;
        $link = '/messages?c='.$conversation->id;
        CompanyUser::query()
            ->where('company_id', $conversation->company_id)
            ->where('status', CompanyStatus::Active)
            ->whereNotNull('user_id')
            ->where('user_id', '!=', $sender->id)
            ->pluck('user_id')
            ->unique()
            ->each(function ($userId) use ($title, $preview, $link) {
                $this->notifications->send([
                    'user_id' => (int) $userId,
                    'title' => $title,
                    'message' => $preview,
                    'type' => NotificationType::General,
                    'target_role' => NotificationTargetRole::Company,
                    'link' => $link,
                ]);
            });
    }

    private function notifyAgency(User $sender, string $title, string $preview, string $link): void
    {
        User::query()
            ->where('role', UserRole::Admin)
            ->where('id', '!=', $sender->id)
            ->orderBy('id')
            ->get()
            ->each(function (User $admin) use ($title, $preview, $link) {
                $this->notifications->send([
                    'user_id' => $admin->id,
                    'title' => $title,
                    'message' => $preview,
                    'type' => NotificationType::General,
                    'target_role' => NotificationTargetRole::Admin,
                    'link' => $link,
                ]);
            });
    }

    private function requiredText(string $value, string $field, string $key, int $max): string
    {
        $text = trim($value);
        if ($text === '') {
            throw ValidationException::withMessages([
                $field => [__($key)],
            ]);
        }

        if (mb_strlen($text) > $max) {
            throw ValidationException::withMessages([
                $field => [__('validation.max.string', ['attribute' => $field, 'max' => $max])],
            ]);
        }

        return $text;
    }

    private function canUseCampaign(User $user, Campaign $campaign): bool
    {
        if ($user->role === UserRole::Admin) {
            return true;
        }

        if ($user->role === UserRole::Company) {
            return (int) $user->actingCompanyId() === (int) $campaign->company_id;
        }

        $creator = $user->creator;
        if (! $creator || $campaign->status === CampaignStatus::PendingAgency) {
            return false;
        }

        return $this->approvedOnCampaign((int) $creator->id, (int) $campaign->id);
    }

    private function canUseRecurring(User $user, RecurringContract $contract): bool
    {
        if ($user->role === UserRole::Admin) {
            return true;
        }

        if ($user->role === UserRole::Company) {
            return (int) $user->actingCompanyId() === (int) $contract->company_id;
        }

        $creator = $user->creator;
        if (! $creator || $contract->status === RecurringContractStatus::PendingAgency) {
            return false;
        }

        return $this->creatorIsOnRecurring((int) $creator->id, (int) $contract->id);
    }

    private function creatorIsOnWork(int $creatorId, ?int $campaignId, ?int $recurringId): bool
    {
        if ($campaignId) {
            return $this->approvedOnCampaign($creatorId, $campaignId);
        }

        return $recurringId ? $this->creatorIsOnRecurring($creatorId, $recurringId) : false;
    }

    private function approvedOnCampaign(int $creatorId, int $campaignId): bool
    {
        return CampaignCreator::query()
            ->where('campaign_id', $campaignId)
            ->where('creator_id', $creatorId)
            ->where('application_status', ApplicationStatus::Approved)
            ->exists();
    }

    private function creatorIsOnRecurring(int $creatorId, int $contractId): bool
    {
        $onRoster = RecurringContractCreator::query()
            ->where('recurring_contract_id', $contractId)
            ->where('creator_id', $creatorId)
            ->exists();
        if ($onRoster) {
            return true;
        }

        return ContentPlanningItem::query()
            ->where('recurring_contract_id', $contractId)
            ->where('creator_id', $creatorId)
            ->exists();
    }

    /**
     * @return array{works: list<array<string, mixed>>, truncated: bool}
     */
    private function worksFor(User $user, string $term, ?int $companyId = null): array
    {
        $includeCreators = $user->role !== UserRole::Creator;
        $campaigns = $this->campaignQuery($user, $term, $companyId)
            ->with([
                'company:id,name',
                'campaignCreators' => fn ($query) => $query
                    ->where('application_status', ApplicationStatus::Approved)
                    ->with('creator:id,artistic_name,full_name'),
            ])
            ->orderBy('name')
            ->limit(self::RECIPIENT_LIMIT + 1)
            ->get();
        $contracts = $this->recurringQuery($user, $term, $companyId)
            ->with([
                'company:id,name',
                'recurringContractCreators.creator:id,artistic_name,full_name',
                'contentPlanningItems.creator:id,artistic_name,full_name',
            ])
            ->orderBy('title')
            ->limit(self::RECIPIENT_LIMIT + 1)
            ->get();

        $works = [];
        foreach ($campaigns->take(self::RECIPIENT_LIMIT) as $campaign) {
            $works[] = $this->campaignWork($campaign, $includeCreators);
        }
        foreach ($contracts->take(self::RECIPIENT_LIMIT) as $contract) {
            $works[] = $this->recurringWork($contract, $includeCreators);
        }

        usort($works, fn (array $left, array $right) => strcasecmp((string) $left['name'], (string) $right['name']));

        return [
            'works' => array_slice($works, 0, self::RECIPIENT_LIMIT),
            'truncated' => $campaigns->count() > self::RECIPIENT_LIMIT
                || $contracts->count() > self::RECIPIENT_LIMIT
                || count($works) > self::RECIPIENT_LIMIT,
        ];
    }

    private function campaignQuery(User $user, string $term, ?int $companyId = null): Builder
    {
        $query = Campaign::query();
        if ($user->role === UserRole::Company) {
            $query->where('company_id', $user->actingCompanyId() ?? 0);
        } elseif ($user->role === UserRole::Admin && $companyId) {
            $query->where('company_id', $companyId);
        } elseif ($user->role === UserRole::Creator) {
            $creatorId = (int) ($user->creator?->id ?? 0);
            $query->where('status', '!=', CampaignStatus::PendingAgency)
                ->whereHas('campaignCreators', fn (Builder $inner) => $inner
                    ->where('creator_id', $creatorId)
                    ->where('application_status', ApplicationStatus::Approved));
        }

        if ($term !== '') {
            $query->where(function (Builder $inner) use ($term) {
                $inner->where('name', 'like', '%'.$term.'%')
                    ->orWhereHas('company', fn (Builder $company) => $company->where('name', 'like', '%'.$term.'%'))
                    ->orWhereHas('campaignCreators.creator', function (Builder $creator) use ($term) {
                        $creator->where('artistic_name', 'like', '%'.$term.'%')
                            ->orWhere('full_name', 'like', '%'.$term.'%');
                    });
            });
        }

        return $query;
    }

    private function recurringQuery(User $user, string $term, ?int $companyId = null): Builder
    {
        $query = RecurringContract::query();
        if ($user->role === UserRole::Company) {
            $query->where('company_id', $user->actingCompanyId() ?? 0);
        } elseif ($user->role === UserRole::Admin && $companyId) {
            $query->where('company_id', $companyId);
        } elseif ($user->role === UserRole::Creator) {
            $creatorId = (int) ($user->creator?->id ?? 0);
            $query->where('status', '!=', RecurringContractStatus::PendingAgency)
                ->where(function (Builder $inner) use ($creatorId) {
                    $inner->whereHas('recurringContractCreators', fn (Builder $roster) => $roster->where('creator_id', $creatorId))
                        ->orWhereHas('contentPlanningItems', fn (Builder $item) => $item->where('creator_id', $creatorId));
                });
        }

        if ($term !== '') {
            $query->where(function (Builder $inner) use ($term) {
                $inner->where('title', 'like', '%'.$term.'%')
                    ->orWhereHas('company', fn (Builder $company) => $company->where('name', 'like', '%'.$term.'%'))
                    ->orWhereHas('recurringContractCreators.creator', function (Builder $creator) use ($term) {
                        $creator->where('artistic_name', 'like', '%'.$term.'%')
                            ->orWhere('full_name', 'like', '%'.$term.'%');
                    });
            });
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    private function campaignWork(Campaign $campaign, bool $includeCreators): array
    {
        $creators = [];
        if ($includeCreators) {
            foreach ($campaign->campaignCreators as $row) {
                if (! $row->creator) {
                    continue;
                }
                $creators[(int) $row->creator->id] = [
                    'id' => (int) $row->creator->id,
                    'name' => self::creatorName($row->creator),
                ];
            }
        }

        return [
            'kind' => 'campaign',
            'id' => (int) $campaign->id,
            'name' => (string) $campaign->name,
            'company' => $campaign->company ? [
                'id' => (int) $campaign->company->id,
                'name' => (string) $campaign->company->name,
            ] : null,
            'creators' => array_values($creators),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function recurringWork(RecurringContract $contract, bool $includeCreators): array
    {
        $creators = [];
        if ($includeCreators) {
            foreach ($contract->recurringContractCreators as $row) {
                if (! $row->creator) {
                    continue;
                }
                $creators[(int) $row->creator->id] = [
                    'id' => (int) $row->creator->id,
                    'name' => self::creatorName($row->creator),
                ];
            }
            foreach ($contract->contentPlanningItems as $item) {
                if (! $item->creator) {
                    continue;
                }
                $creators[(int) $item->creator->id] = [
                    'id' => (int) $item->creator->id,
                    'name' => self::creatorName($item->creator),
                ];
            }
        }

        return [
            'kind' => 'recurring',
            'id' => (int) $contract->id,
            'name' => (string) $contract->title,
            'company' => $contract->company ? [
                'id' => (int) $contract->company->id,
                'name' => (string) $contract->company->name,
            ] : null,
            'creators' => array_values($creators),
        ];
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function agencyCompanies(): array
    {
        $ids = Campaign::query()->distinct()->pluck('company_id')
            ->merge(RecurringContract::query()->distinct()->pluck('company_id'))
            ->filter()
            ->unique()
            ->values();

        return Company::query()
            ->whereIn('id', $ids)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Company $company) => [
                'id' => (int) $company->id,
                'name' => (string) $company->name,
            ])
            ->all();
    }

    private function term(?string $search): string
    {
        return trim(str_replace(['%', '_'], '', (string) $search));
    }
}
