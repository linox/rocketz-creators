<?php

namespace App\Support;

use App\Enums\NotificationType;
use App\Enums\StageApprovalStatus;
use App\Services\NotificationService;

class ContentReaction
{
    /**
     * @return array<string, list<string>>
     */
    public static function rules(): array
    {
        return [
            'script_liked' => ['sometimes', 'boolean'],
            'script_reaction' => ['nullable', 'string', 'max:1000'],
            'video_liked' => ['sometimes', 'boolean'],
            'video_reaction' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Normalizes the note, drops a previous reaction when that stage is sent again,
     * and returns the reactions worth telling the creator about.
     *
     * @param  array<string, mixed>  $data
     * @param  list<array{stage: string, liked: bool, message: string|null}>  $changes
     * @return array<string, mixed>
     */
    public static function prepare(object $before, array $data, array &$changes): array
    {
        $data = self::normalize($data);
        $data = self::clearOnResubmit($data);
        $changes = self::freshReactions($before, $data);

        return $data;
    }

    /**
     * @param  list<array{stage: string, liked: bool, message: string|null}>  $changes
     * @param  array<string, mixed>  $context
     */
    public static function notify(
        NotificationService $notifications,
        int $creatorId,
        string $pieceTitle,
        string $link,
        array $changes,
        array $context = [],
    ): void {
        foreach ($changes as $change) {
            $message = $change['message'];
            $notifications->notifyCreator($creatorId, array_merge($context, [
                'title' => $change['liked']
                    ? __('auth.content_liked_title')
                    : __('auth.content_reaction_title'),
                'message' => is_string($message) && $message !== ''
                    ? $message
                    : __('auth.content_liked', ['title' => $pieceTitle]),
                'type' => NotificationType::Approval,
                'link' => $link,
            ]));
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private static function normalize(array $data): array
    {
        foreach (['script_reaction', 'video_reaction'] as $key) {
            if (! array_key_exists($key, $data)) {
                continue;
            }
            $trimmed = trim((string) ($data[$key] ?? ''));
            $data[$key] = $trimmed !== '' ? $trimmed : null;
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private static function clearOnResubmit(array $data): array
    {
        if (NotificationService::is($data['script_status'] ?? null, StageApprovalStatus::Submitted)) {
            $data['script_liked'] = false;
            $data['script_reaction'] = null;
        }
        if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Submitted)) {
            $data['video_liked'] = false;
            $data['video_reaction'] = null;
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{stage: string, liked: bool, message: string|null}>
     */
    private static function freshReactions(object $before, array $data): array
    {
        $changes = [];
        foreach (['script', 'video'] as $stage) {
            $likedKey = $stage.'_liked';
            $messageKey = $stage.'_reaction';
            if (! array_key_exists($likedKey, $data) && ! array_key_exists($messageKey, $data)) {
                continue;
            }

            $liked = array_key_exists($likedKey, $data)
                ? (bool) $data[$likedKey]
                : (bool) ($before->{$likedKey} ?? false);
            $message = array_key_exists($messageKey, $data)
                ? $data[$messageKey]
                : ($before->{$messageKey} ?? null);
            $message = is_string($message) && trim($message) !== '' ? trim($message) : null;

            $previousLiked = (bool) ($before->{$likedKey} ?? false);
            $previousMessage = trim((string) ($before->{$messageKey} ?? '')) ?: null;
            if ($liked === $previousLiked && $message === $previousMessage) {
                continue;
            }
            if (! $liked && $message === null) {
                continue;
            }

            $changes[] = [
                'stage' => $stage,
                'liked' => $liked,
                'message' => $message,
            ];
        }

        return $changes;
    }
}
