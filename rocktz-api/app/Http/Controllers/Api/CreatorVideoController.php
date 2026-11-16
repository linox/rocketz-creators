<?php

namespace App\Http\Controllers\Api;

use App\Enums\CreatorVideoSource;
use App\Enums\CreatorVideoUsageKind;
use App\Enums\CreatorVideoUsageSource;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\CreatorVideo;
use App\Models\CreatorVideoUsage;
use App\Models\User;
use App\Services\CreatorVideoLibrary;
use App\Support\MediaUrl;
use App\Support\SafeHttpUrl;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CreatorVideoController extends Controller
{
    public function index(Request $request, CreatorVideoLibrary $library): JsonResponse
    {
        $user = $request->user();
        $library->syncVisible($user);
        $videos = $this->visibleQuery($user)
            ->with([
                'creator:id,artistic_name,full_name,photo_url',
                'company:id,name',
                'campaign:id,name,company_id',
                'campaign.company:id,name',
                'recurringContract:id,title',
                'usages.recorder:id,name',
            ])
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $videos->map(fn (CreatorVideo $video) => $this->present($video, $library, $this->canManage($user, $video)))->values(),
            'meta' => [
                'total' => $videos->count(),
                'unused' => $videos->filter(fn (CreatorVideo $video) => $video->usages->isEmpty())->count(),
                'posted' => $videos->filter(fn (CreatorVideo $video) => $this->hasKind($video, CreatorVideoUsageKind::Posted))->count(),
                'ad' => $videos->filter(fn (CreatorVideo $video) => $this->hasKind($video, CreatorVideoUsageKind::Ad))->count(),
            ],
        ]);
    }

    public function storeUsage(Request $request, CreatorVideo $creatorVideo, CreatorVideoLibrary $library): JsonResponse
    {
        $user = $request->user();
        $video = $this->findVisible($user, $creatorVideo->id);
        abort_unless($this->canManage($user, $video), 403, __('auth.forbidden'));

        $data = $request->validate([
            'kind' => ['required', Rule::enum(CreatorVideoUsageKind::class)],
            'url' => ['nullable', 'string', 'max:2048'],
            'note' => ['nullable', 'string', 'max:500'],
            'occurred_at' => ['nullable', 'date'],
        ]);

        $url = $this->blank($data['url'] ?? null);
        if ($url !== null && ! SafeHttpUrl::isValid($url)) {
            throw ValidationException::withMessages(['url' => __('videos.invalid_url')]);
        }

        $video->usages()->create([
            'kind' => CreatorVideoUsageKind::from($data['kind']),
            'url' => $url,
            'note' => $this->blank($data['note'] ?? null),
            'occurred_at' => isset($data['occurred_at']) ? Carbon::parse($data['occurred_at']) : now(),
            'recorded_by' => $user->id,
            'source' => CreatorVideoUsageSource::Manual,
        ]);

        return response()->json([
            'data' => $this->present($this->reload($video), $library, true),
        ], 201);
    }

    public function destroyUsage(Request $request, CreatorVideo $creatorVideo, CreatorVideoUsage $creatorVideoUsage, CreatorVideoLibrary $library): JsonResponse
    {
        $user = $request->user();
        $video = $this->findVisible($user, $creatorVideo->id);
        abort_unless($this->canManage($user, $video), 403, __('auth.forbidden'));
        abort_unless($creatorVideoUsage->creator_video_id === $video->id, 404);

        if ($creatorVideoUsage->source === CreatorVideoUsageSource::Auto && filled($creatorVideoUsage->fingerprint)) {
            $dismissed = $video->dismissed_fingerprints ?? [];
            $dismissed[] = $creatorVideoUsage->fingerprint;
            $video->dismissed_fingerprints = array_values(array_unique($dismissed));
            $video->save();
        }

        $creatorVideoUsage->delete();

        return response()->json([
            'data' => $this->present($this->reload($video), $library, true),
        ]);
    }

    /**
     * @return Builder<CreatorVideo>
     */
    private function visibleQuery(User $user): Builder
    {
        $query = CreatorVideo::query();
        if ($user->role === UserRole::Admin) {
            return $query;
        }
        if ($user->role === UserRole::Company) {
            return $query->where('company_id', $user->actingCompanyId() ?? 0);
        }
        if ($user->role === UserRole::Creator) {
            return $query->where('creator_id', $user->creator?->id ?? 0);
        }

        abort(403, __('auth.forbidden'));
    }

    private function findVisible(User $user, int $id): CreatorVideo
    {
        return $this->visibleQuery($user)->findOrFail($id);
    }

    private function canManage(User $user, CreatorVideo $video): bool
    {
        if ($user->role === UserRole::Admin) {
            return true;
        }

        return $user->role === UserRole::Company
            && (int) $video->company_id === (int) ($user->actingCompanyId() ?? 0);
    }

    private function reload(CreatorVideo $video): CreatorVideo
    {
        $video->unsetRelation('usages');

        return $video->load([
            'creator:id,artistic_name,full_name,photo_url',
            'company:id,name',
            'campaign:id,name,company_id',
            'campaign.company:id,name',
            'recurringContract:id,title',
            'usages.recorder:id,name',
        ]);
    }

    private function hasKind(CreatorVideo $video, CreatorVideoUsageKind $kind): bool
    {
        return $video->usages->contains(fn (CreatorVideoUsage $usage) => $usage->kind === $kind);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(CreatorVideo $video, CreatorVideoLibrary $library, bool $canManage): array
    {
        $posted = $this->hasKind($video, CreatorVideoUsageKind::Posted);
        $ad = $this->hasKind($video, CreatorVideoUsageKind::Ad);
        $status = match (true) {
            $posted && $ad => 'posted_and_ad',
            $posted => 'posted',
            $ad => 'ad',
            default => 'unused',
        };

        return [
            'id' => $video->id,
            'title' => $video->title,
            'content_type' => $video->content_type,
            'format' => $library->formatLabel($video->content_type, $video->source === CreatorVideoSource::Campaign ? $video->position : null),
            'video_url' => MediaUrl::publicAbsolute($video->video_url),
            'video_file_size' => $video->video_file_size,
            'received_at' => $video->received_at?->toIso8601String(),
            'source' => $video->source?->value,
            'status' => $status,
            'can_manage' => $canManage,
            'campaign_id' => $video->campaign_id,
            'campaign_name' => $video->campaign?->name,
            'recurring_contract_id' => $video->recurring_contract_id,
            'contract_name' => $video->recurringContract?->title,
            'company_name' => $video->company?->name ?? $video->campaign?->company?->name,
            'creator' => [
                'id' => $video->creator?->id,
                'artistic_name' => $video->creator?->artistic_name,
                'full_name' => $video->creator?->full_name,
                'photo_url' => $video->creator?->photo_url,
            ],
            'usages' => $video->usages->map(fn (CreatorVideoUsage $usage) => [
                'id' => $usage->id,
                'kind' => $usage->kind?->value,
                'url' => $usage->url,
                'note' => $usage->note,
                'occurred_at' => $usage->occurred_at?->toIso8601String(),
                'source' => $usage->source?->value,
                'recorded_by' => $usage->recorder?->name,
            ])->values(),
        ];
    }

    private function blank(mixed $value): ?string
    {
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }
}
