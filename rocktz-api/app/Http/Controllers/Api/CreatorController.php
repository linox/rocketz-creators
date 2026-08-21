<?php

namespace App\Http\Controllers\Api;

use App\Enums\CreatorStatus;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CreatorResource;
use App\Models\Creator;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\Geo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CreatorController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Creator::query()->with(['user', 'portfolioVideos']);

        if ($user->role === UserRole::Creator) {
            $query->where('id', $user->creator?->id);
        } elseif ($user->role === UserRole::Company) {
            $query->where('status', CreatorStatus::Active);
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($search = $request->string('q')->toString()) {
            $query->where(function ($builder) use ($search) {
                $builder->where('full_name', 'like', "%{$search}%")
                    ->orWhere('artistic_name', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%");
            });
        }

        if ($category = $request->string('category')->toString()) {
            $query->whereJsonContains('categories', $category);
        }

        $creators = $query->latest()->get();

        return response()->json(['data' => CreatorResource::collection($creators)]);
    }

    public function show(Request $request, Creator $creator): JsonResponse
    {
        $user = $request->user();

        if ($user->role === UserRole::Creator && $user->creator?->id !== $creator->id) {
            return response()->json(['message' => __('auth.forbidden')], 403);
        }

        if ($user->role === UserRole::Company && $creator->status !== CreatorStatus::Active) {
            return response()->json(['message' => __('auth.profile_unavailable')], 403);
        }

        $creator->load(['user', 'portfolioVideos', 'contractAcceptances' => fn ($q) => $q->latest()]);

        return response()->json(['data' => new CreatorResource($creator)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'artistic_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:6'],
            'whatsapp' => ['nullable', 'string', 'max:30'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => Geo::countryRules(false),
            'state' => Geo::regionRules($request->string('country')->toString() ?: null, false),
            'cpf' => ['nullable', 'string', 'max:20'],
            'photo_url' => ['nullable', 'string', 'max:2048'],
            'instagram' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:120'],
            'can_access_all_countries' => ['sometimes', 'boolean'],
            'status' => ['nullable', Rule::enum(CreatorStatus::class)],
        ]);

        $handle = ltrim((string) ($data['instagram'] ?? $data['artistic_name']), '@');

        $creator = DB::transaction(function () use ($data, $handle) {
            $user = User::query()->create([
                'name' => $data['full_name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'] ?? Str::password(12),
                'role' => UserRole::Creator,
            ]);

            return Creator::query()->create([
                'user_id' => $user->id,
                'full_name' => $data['full_name'],
                'artistic_name' => $data['artistic_name'],
                'photo_url' => $data['photo_url'] ?? null,
                'cpf' => $data['cpf'] ?? null,
                'document' => $data['cpf'] ?? null,
                'whatsapp' => $data['whatsapp'] ?? null,
                'city' => $data['city'] ?? null,
                'country' => Geo::normalizeCountry($data['country'] ?? Geo::DEFAULT_COUNTRY),
                'state' => isset($data['state']) ? Geo::normalizeRegion($data['state']) : null,
                'can_access_all_countries' => (bool) ($data['can_access_all_countries'] ?? false),
                'socials' => ['instagram' => $handle],
                'metrics' => ['followers' => 0, 'avgViews' => 0, 'avgEngagement' => 0],
                'categories' => array_values(array_filter([$data['category'] ?? null])),
                'pricing' => ['story' => 0, 'reel' => 0, 'post' => 0],
                'status' => $data['status'] ?? CreatorStatus::Review,
                'internal_notes' => 'Cadastrado pelo admin.',
            ]);
        });

        return response()->json(['data' => new CreatorResource($creator->load('user'))], 201);
    }

    public function update(Request $request, Creator $creator): JsonResponse
    {
        $user = $request->user();
        if ($user->role === UserRole::Creator && $user->creator?->id !== $creator->id) {
            return response()->json(['message' => __('auth.forbidden')], 403);
        }

        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'artistic_name' => ['sometimes', 'string', 'max:255'],
            'photo_url' => ['nullable', 'string', 'max:2048'],
            'whatsapp' => ['sometimes', 'string', 'max:30'],
            'city' => ['sometimes', 'string', 'max:120'],
            'country' => Geo::countryRules(false),
            'state' => Geo::regionRules($request->input('country') ?: $creator->country, false),
            'bio' => ['nullable', 'string'],
            'document' => ['nullable', 'string', 'max:40'],
            'cpf' => ['nullable', 'string', 'max:20'],
            'pix_key' => ['nullable', 'string', 'max:255'],
            'bank_details' => ['nullable', 'string'],
            'socials' => ['nullable', 'array'],
            'socials.instagram' => ['nullable', 'string', 'max:255'],
            'socials.tiktok' => ['nullable', 'string', 'max:255'],
            'socials.youtube' => ['nullable', 'string', 'max:255'],
            'socials.kwai' => ['nullable', 'string', 'max:255'],
            'metrics' => ['nullable', 'array'],
            'categories' => ['nullable', 'array'],
            'pricing' => ['nullable', 'array'],
            'work_affinities' => ['nullable', 'array'],
            'accepts_exchange' => ['sometimes', 'boolean'],
            'accepts_paid_traffic' => ['sometimes', 'boolean'],
            'accepts_exclusivity' => ['sometimes', 'boolean'],
            'internal_notes' => ['nullable', 'string'],
            'can_access_all_countries' => ['sometimes', 'boolean'],
            'status' => ['nullable', Rule::enum(CreatorStatus::class)],
        ]);

        $isAdmin = $user->role === UserRole::Admin;
        if (! $isAdmin) {
            unset($data['status'], $data['internal_notes'], $data['can_access_all_countries']);
        }

        if (isset($data['country'])) {
            $data['country'] = Geo::normalizeCountry($data['country']);
        }

        if (isset($data['state'])) {
            $data['state'] = Geo::normalizeRegion($data['state']);
        }

        $creator->fill($data)->save();

        if (isset($data['full_name'])) {
            $creator->user?->update(['name' => $data['full_name']]);
        }

        return response()->json(['data' => new CreatorResource($creator->fresh()->load(['user', 'portfolioVideos']))]);
    }

    public function approve(Creator $creator): JsonResponse
    {
        $creator->update(['status' => CreatorStatus::Active]);
        if ($creator->user_id) {
            $this->notifications->send([
                'user_id' => $creator->user_id,
                'creator_id' => $creator->id,
                'title' => 'Cadastro aprovado',
                'message' => 'Seu perfil foi aprovado e já pode participar de campanhas.',
                'type' => NotificationType::Approval,
                'target_role' => NotificationTargetRole::Creator,
                'link' => '/available-campaigns',
            ]);
        }

        return response()->json(['data' => new CreatorResource($creator->fresh()->load('user'))]);
    }

    public function reject(Request $request, Creator $creator): JsonResponse
    {
        $creator->update([
            'status' => CreatorStatus::Rejected,
            'internal_notes' => trim($creator->internal_notes."\n".$request->string('reason')),
        ]);

        if ($creator->user_id) {
            $this->notifications->send([
                'user_id' => $creator->user_id,
                'creator_id' => $creator->id,
                'title' => 'Cadastro não aprovado',
                'message' => $request->string('reason')->toString() ?: 'Seu cadastro não foi aprovado neste momento.',
                'type' => NotificationType::Rejection,
                'target_role' => NotificationTargetRole::Creator,
                'link' => '/creator-dashboard',
            ]);
        }

        return response()->json(['data' => new CreatorResource($creator->fresh()->load('user'))]);
    }

    public function updatePassword(Request $request, Creator $creator): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:6'],
        ]);

        abort_unless($creator->user, 422, __('auth.creator_without_user'));

        $creator->user->update(['password' => $data['password']]);

        if ($creator->user_id) {
            $this->notifications->send([
                'user_id' => $creator->user_id,
                'creator_id' => $creator->id,
                'title' => 'Senha de acesso atualizada',
                'message' => 'Sua senha de acesso à plataforma foi atualizada com sucesso.',
                'type' => NotificationType::General,
                'target_role' => NotificationTargetRole::Creator,
                'link' => '/creators/'.$creator->id,
            ]);
        }

        return response()->json(['message' => __('auth.password_updated')]);
    }

    public function resetCasting(): JsonResponse
    {
        $deleted = User::query()->where('role', UserRole::Creator)->count();
        User::query()->where('role', UserRole::Creator)->delete();

        return response()->json(['message' => __('auth.casting_reset'), 'deleted' => $deleted]);
    }

    public function storePortfolio(Request $request, Creator $creator): JsonResponse
    {
        $this->authorizeCreator($request, $creator);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'url' => ['required', 'string', 'max:2048'],
            'description' => ['nullable', 'string'],
            'orientation' => ['nullable', 'in:horizontal,vertical'],
            'file_size' => ['nullable', 'integer', 'min:0'],
        ]);

        $video = $creator->portfolioVideos()->create([
            ...$data,
            'file_size' => $data['file_size'] ?? 0,
            'uploaded_at' => now(),
        ]);

        return response()->json(['data' => $video], 201);
    }

    public function destroyPortfolio(Request $request, Creator $creator, int $video): JsonResponse
    {
        $this->authorizeCreator($request, $creator);
        $creator->portfolioVideos()->whereKey($video)->delete();

        return response()->json(['message' => __('auth.video_removed')]);
    }

    public function acceptContract(Request $request, Creator $creator): JsonResponse
    {
        $this->authorizeCreator($request, $creator);
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'document' => ['nullable', 'string', 'max:40'],
            'email' => ['required', 'email'],
        ]);

        $acceptance = $creator->contractAcceptances()->create([
            'term_id' => 'rocketz-2026',
            'version' => '1.0 (2026)',
            'full_name' => $data['full_name'],
            'document' => $data['document'] ?? null,
            'email' => $data['email'],
            'accepted_at' => now(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'declarations' => ['all' => true],
            'all_accepted' => true,
            'status' => 'valid',
        ]);

        return response()->json(['data' => $acceptance], 201);
    }

    private function authorizeCreator(Request $request, Creator $creator): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        abort_unless($user->role === UserRole::Creator && $user->creator?->id === $creator->id, 403, __('auth.forbidden'));
    }
}
