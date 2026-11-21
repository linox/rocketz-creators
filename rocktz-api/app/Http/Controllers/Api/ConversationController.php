<?php

namespace App\Http\Controllers\Api;

use App\Enums\ConversationCloseReason;
use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Services\ConversationMailbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ConversationController extends Controller
{
    public function __construct(private ConversationMailbox $mailbox) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $conversations = $this->mailbox->visibleQuery($user)
            ->with([
                'company:id,name',
                'creator:id,user_id,artistic_name,full_name,photo_url',
                'campaign:id,name',
                'recurringContract:id,title',
                'latestMessage.user:id,name,role,avatar_url,chat_name,chat_avatar_url',
                'reads' => fn ($query) => $query->where('user_id', $user->id),
            ])
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        $conversations->each(function (Conversation $conversation) {
            $readId = (int) ($conversation->reads->first()?->last_read_message_id ?? 0);
            $latestId = (int) ($conversation->latestMessage?->id ?? 0);
            $conversation->setAttribute('unread_for_viewer', $latestId > $readId);
        });
        $this->mailbox->attachParticipants($conversations);

        return response()->json([
            'data' => ConversationResource::collection($conversations)->resolve($request),
            'meta' => ['unread' => $this->mailbox->unreadCount($user)],
        ]);
    }

    public function recipients(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'company_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $this->mailbox->recipients(
                $request->user(),
                $data['q'] ?? null,
                isset($data['company_id']) ? (int) $data['company_id'] : null,
            ),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:160'],
            'body' => ['required', 'string', 'max:5000'],
            'campaign_id' => ['nullable', 'integer', 'exists:campaigns,id', 'required_without:recurring_contract_id', 'prohibits:recurring_contract_id'],
            'recurring_contract_id' => ['nullable', 'integer', 'exists:recurring_contracts,id', 'required_without:campaign_id', 'prohibits:campaign_id'],
            'creator_id' => ['nullable', 'integer', 'exists:creators,id'],
        ]);

        $conversation = $this->mailbox->start($request->user(), $data);
        $conversation = $this->mailbox->present($conversation, $request->user(), true);

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve($request),
        ], 201);
    }

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();
        $this->mailbox->assertCanView($user, $conversation);
        $this->mailbox->markRead($user, $conversation);
        $conversation = $this->mailbox->present($conversation, $user, true);

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve($request),
        ]);
    }

    public function close(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', Rule::enum(ConversationCloseReason::class)],
        ]);
        $reason = $data['reason'] instanceof ConversationCloseReason ? $data['reason']->value : (string) $data['reason'];
        $this->mailbox->close($request->user(), $conversation, $reason);
        $conversation = $this->mailbox->present($conversation, $request->user(), true);

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve($request),
        ]);
    }

    public function reply(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $this->mailbox->reply($request->user(), $conversation, $data['body']);
        $conversation = $this->mailbox->present($conversation, $request->user(), true);

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve($request),
        ]);
    }
}
