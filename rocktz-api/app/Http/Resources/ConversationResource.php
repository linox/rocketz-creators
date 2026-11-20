<?php

namespace App\Http\Resources;

use App\Enums\ConversationCloseReason;
use App\Enums\UserRole;
use App\Models\ConversationMessage;
use App\Models\User;
use App\Services\ConversationMailbox;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class ConversationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $viewerId = (int) ($request->user()?->id ?? 0);

        return [
            'id' => $this->id,
            'subject' => $this->subject,
            'parties' => [
                'company' => $this->company ? [
                    'id' => $this->company->id,
                    'name' => $this->company->name,
                ] : null,
                'creator' => $this->creator ? [
                    'id' => $this->creator->id,
                    'name' => ConversationMailbox::creatorName($this->creator),
                ] : null,
                'agency' => (bool) $this->with_agency,
            ],
            'work' => $this->workPayload(),
            'participants' => array_values($this->participants ?? []),
            'preview' => $this->relationLoaded('latestMessage') ? $this->previewText($this->latestMessage) : null,
            'preview_author' => $this->relationLoaded('latestMessage') ? $this->latestMessage?->user?->name : null,
            'last_message_at' => $this->last_message_at?->toIso8601String(),
            'closed' => $this->closed_at !== null,
            'closed_at' => $this->closed_at?->toIso8601String(),
            'close_reason' => $this->close_reason instanceof ConversationCloseReason ? $this->close_reason->value : $this->close_reason,
            'unread' => (bool) $this->unread_for_viewer,
            'messages' => $this->whenLoaded('messages', function () use ($viewerId) {
                return $this->messages
                    ->sortBy('id')
                    ->values()
                    ->map(function (ConversationMessage $message) use ($viewerId) {
                        $author = $message->user;

                        return [
                            'id' => $message->id,
                            'body' => $message->body,
                            'created_at' => $message->created_at?->toIso8601String(),
                            'mine' => $author !== null && (int) $author->id === $viewerId,
                            'author' => [
                                'id' => $author?->id,
                                'name' => $author?->name,
                                'photo_url' => $this->photoOf($author),
                                'side' => $this->sideOf($author),
                            ],
                        ];
                    })
                    ->all();
            }),
        ];
    }

    /**
     * @return array{kind: string, id: int, name: string}|null
     */
    private function workPayload(): ?array
    {
        if ($this->relationLoaded('campaign') && $this->campaign) {
            return [
                'kind' => 'campaign',
                'id' => (int) $this->campaign->id,
                'name' => (string) $this->campaign->name,
            ];
        }

        if ($this->relationLoaded('recurringContract') && $this->recurringContract) {
            return [
                'kind' => 'recurring',
                'id' => (int) $this->recurringContract->id,
                'name' => (string) $this->recurringContract->title,
            ];
        }

        return null;
    }

    private function previewText(?ConversationMessage $message): ?string
    {
        if (! $message) {
            return null;
        }

        $flat = trim((string) preg_replace('/\s+/', ' ', $message->body));

        return $flat === '' ? null : Str::limit($flat, 140);
    }

    private function photoOf(?User $author): ?string
    {
        if (! $author) {
            return null;
        }

        if ($author->role === UserRole::Creator) {
            return $author->creator?->photo_url ?: $author->avatar_url;
        }

        return $author->avatar_url;
    }

    private function sideOf(?User $author): ?string
    {
        return match ($author?->role) {
            UserRole::Admin => 'company',
            UserRole::Company => 'company',
            UserRole::Creator => 'creator',
            default => null,
        };
    }
}
