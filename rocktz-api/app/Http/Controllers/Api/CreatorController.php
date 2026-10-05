<?php

namespace App\Http\Controllers\Api;

use App\Enums\CreatorStatus;
use App\Enums\LandingSignupStatus;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CreatorResource;
use App\Jobs\SyncCreatorSocialsJob;
use App\Models\CompanyLandingPage;
use App\Models\CompanyLandingSignup;
use App\Models\Creator;
use App\Models\User;
use App\Services\CompanyLandingService;
use App\Services\Mail\MailNotifier;
use App\Services\NotificationService;
use App\Services\SocialMetricsService;
use App\Support\Geo;
use App\Support\MetricsSyncStatus;
use App\Support\SafeHttpUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Throwable;

class CreatorController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly MailNotifier $mail,
        private readonly SocialMetricsService $socialMetrics,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Creator::query()->with(['user', 'invitedByCompany:id,name']);
        if ($user->role !== UserRole::Company) {
            $query->with('latestContractAcceptance');
        }

        if ($user->role === UserRole::Creator) {
            $query->where('id', $user->creator?->id);
        } elseif ($user->role === UserRole::Company) {
            $companyId = (int) $user->actingCompanyId();
            abort_unless($companyId, 403, __('auth.company_not_linked'));
            $query->inCompanyPool($companyId)
                ->with(['landingSignups' => fn ($inner) => $inner->where('company_id', $companyId)->with($this->landingOriginRelations())]);
        } elseif ($user->role === UserRole::Admin && $request->filled('company_id')) {
            $data = $request->validate([
                'company_id' => ['required', 'integer', 'exists:companies,id'],
                'include_global' => ['sometimes', 'boolean'],
            ]);
            $companyId = (int) $data['company_id'];
            $query->availableToCompanyContext($companyId, (bool) ($data['include_global'] ?? false))
                ->with(['landingSignups' => fn ($inner) => $inner->where('company_id', $companyId)->with($this->landingOriginRelations())]);
        } elseif ($user->role === UserRole::Admin) {
            $query->with(['landingSignups' => fn ($inner) => $inner->with($this->landingOriginRelations())]);
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($search = $request->string('q')->toString()) {
            $canSearchPersonal = $user->role !== UserRole::Company;
            $query->where(function ($builder) use ($search, $canSearchPersonal) {
                $builder->where('artistic_name', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhere('socials', 'like', "%{$search}%");
                if ($canSearchPersonal) {
                    $builder->orWhere('full_name', 'like', "%{$search}%");
                }
            });
        }

        if ($category = $request->string('category')->toString()) {
            $query->whereJsonContains('categories', $category);
        }

        if ($country = $request->string('country')->toString()) {
            $query->where('country', Geo::normalizeCountry($country));
        }

        if ($state = $request->string('state')->toString()) {
            $query->where('state', Geo::normalizeRegion($state));
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

        if ($user->role === UserRole::Company) {
            $companyId = (int) $user->actingCompanyId();
            if (! $companyId || ! $creator->isAccessibleByCompany($companyId)) {
                return response()->json(['message' => __('auth.profile_unavailable')], 403);
            }
        }

        $relations = [
            'user',
            'portfolioVideos',
            'contractAcceptances' => fn ($q) => $q->latest(),
            'invitedByCompany',
        ];
        if ($user->role === UserRole::Admin || $user->role === UserRole::Company) {
            $relations['landingSignups'] = function ($query) use ($user) {
                $query->with($this->landingOriginRelations());
                if ($user->role === UserRole::Company) {
                    $query->where('company_id', (int) $user->actingCompanyId());
                }
            };
        }
        $creator->load($relations);

        return response()->json(['data' => new CreatorResource($creator)]);
    }

    public function attachLandingOrigin(Request $request, Creator $creator): JsonResponse
    {
        $user = $request->user();
        $page = $this->landingPageForOrigin($request, $creator);

        app(CompanyLandingService::class)->assignOrigin($page, $creator, $user);

        return $this->show($request, $creator->fresh());
    }

    public function detachLandingOrigin(Request $request, Creator $creator, CompanyLandingSignup $signup): JsonResponse
    {
        $user = $request->user();
        abort_unless((int) $signup->creator_id === (int) $creator->id, 404);

        if ($user->role === UserRole::Company) {
            $companyId = (int) $user->actingCompanyId();
            abort_unless($companyId > 0 && (int) $signup->company_id === $companyId, 403, __('auth.forbidden'));
            abort_unless($creator->isAccessibleByCompany($companyId), 403, __('auth.profile_unavailable'));
        } elseif ($user->role !== UserRole::Admin) {
            abort(403, __('auth.forbidden'));
        }

        $signup->delete();

        return $this->show($request, $creator->fresh());
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();
        $isCompany = $actor->role === UserRole::Company;

        if ($actor->role === UserRole::Admin) {
            abort_unless($actor->hasPermission(Permission::CreatorsModerate), 403, __('auth.forbidden_permission'));
        } elseif (! $isCompany) {
            abort(403, __('auth.forbidden'));
        }

        $companyId = null;
        if ($isCompany) {
            $companyId = (int) $actor->actingCompanyId();
            abort_unless($companyId > 0, 403, __('auth.company_not_linked'));
        }

        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'artistic_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:8'],
            'whatsapp' => ['nullable', 'string', 'max:30'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => Geo::countryRules(false),
            'currency' => Geo::currencyRules(false),
            'state' => Geo::regionRules($request->string('country')->toString() ?: null, false),
            'cpf' => ['nullable', 'string', 'max:40'],
            'photo_url' => ['nullable', 'string', 'max:2048'],
            'instagram' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:120'],
            'can_access_all_countries' => ['sometimes', 'boolean'],
            'status' => ['nullable', Rule::enum(CreatorStatus::class)],
        ]);

        if ($isCompany) {
            unset($data['status'], $data['can_access_all_countries'], $data['cpf']);
        }

        $handle = ltrim((string) ($data['instagram'] ?? $data['artistic_name']), '@');
        $country = Geo::normalizeCountry($data['country'] ?? Geo::DEFAULT_COUNTRY);

        $creator = DB::transaction(function () use ($data, $handle, $isCompany, $companyId, $country) {
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
                'cpf' => $isCompany ? null : ($data['cpf'] ?? null),
                'document' => $isCompany ? null : ($data['cpf'] ?? null),
                'whatsapp' => $data['whatsapp'] ?? null,
                'city' => $data['city'] ?? null,
                'country' => $country,
                'currency' => Geo::normalizeCurrency($data['currency'] ?? Geo::defaultCurrency($country)),
                'state' => isset($data['state']) ? Geo::normalizeRegion($data['state']) : null,
                'can_access_all_countries' => (bool) ($data['can_access_all_countries'] ?? false),
                'socials' => ['instagram' => $handle],
                'metrics' => ['followers' => 0, 'avgViews' => 0, 'avgEngagement' => 0],
                'categories' => array_values(array_filter([$data['category'] ?? null])),
                'pricing' => ['story' => 0, 'reel' => 0, 'post' => 0],
                'status' => $isCompany ? CreatorStatus::Active : ($data['status'] ?? CreatorStatus::Review),
                'invited_by_company_id' => $companyId,
                'internal_notes' => $isCompany
                    ? __('auth.creator_registered_by_company')
                    : 'Cadastrado pelo admin.',
            ]);
        });

        $creator->load('user');

        if ($isCompany && $creator->user) {
            try {
                $this->mail->creatorApproved($creator);
            } catch (Throwable $e) {
                report($e);
            }
        }

        $queued = $this->socialMetrics->queue($creator);

        return response()->json($this->creatorPayload($creator->fresh()->load('user'), $queued), 201);
    }

    public function update(Request $request, Creator $creator): JsonResponse
    {
        $user = $request->user();
        $isSelf = $user->role === UserRole::Creator && $user->creator?->id === $creator->id;
        if ($user->role !== UserRole::Admin && ! $isSelf) {
            return response()->json(['message' => __('auth.forbidden')], 403);
        }

        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'artistic_name' => ['sometimes', 'string', 'max:255'],
            'photo_url' => ['nullable', 'string', 'max:2048'],
            'whatsapp' => ['sometimes', 'string', 'max:30'],
            'city' => ['sometimes', 'string', 'max:120'],
            'country' => Geo::countryRules(false),
            'currency' => Geo::currencyRules(false),
            'state' => Geo::regionRules($request->input('country') ?: $creator->country, false),
            'bio' => ['nullable', 'string'],
            'document' => ['nullable', 'string', 'max:40'],
            'cpf' => ['nullable', 'string', 'max:40'],
            'pix_key' => ['nullable', 'string', 'max:255'],
            'bank_details' => ['nullable', 'string'],
            'socials' => ['nullable', 'array'],
            'socials.instagram' => ['nullable', 'string', 'max:255'],
            'socials.tiktok' => ['nullable', 'string', 'max:255'],
            'socials.youtube' => ['nullable', 'string', 'max:255'],
            'socials.kwai' => ['nullable', 'string', 'max:255'],
            'metrics' => ['nullable', 'array'],
            'categories' => ['nullable', 'array', 'max:20'],
            'categories.*' => ['nullable', 'string', 'max:120'],
            'pricing' => ['nullable', 'array'],
            'work_affinities' => ['nullable', 'array'],
            'accepts_exchange' => ['sometimes', 'boolean'],
            'accepts_paid_traffic' => ['sometimes', 'boolean'],
            'accepts_exclusivity' => ['sometimes', 'boolean'],
            'internal_notes' => ['nullable', 'string'],
            'can_access_all_countries' => ['sometimes', 'boolean'],
            'storefront_enabled' => ['sometimes', 'boolean'],
            'status' => ['nullable', Rule::enum(CreatorStatus::class)],
        ]);

        $isAdmin = $user->role === UserRole::Admin;
        if (! $isAdmin) {
            unset($data['status'], $data['internal_notes'], $data['can_access_all_countries'], $data['metrics'], $data['storefront_enabled']);
        }

        if (isset($data['country'])) {
            $data['country'] = Geo::normalizeCountry($data['country']);
        }

        if (isset($data['currency'])) {
            $data['currency'] = Geo::normalizeCurrency($data['currency']);
        }

        if (isset($data['state'])) {
            $data['state'] = Geo::normalizeRegion($data['state']);
        }

        $data = SafeHttpUrl::validateFields($data, ['photo_url']);

        if (array_key_exists('categories', $data)) {
            $data['categories'] = collect($data['categories'] ?? [])
                ->map(fn ($item) => trim((string) $item))
                ->filter()
                ->unique()
                ->take(20)
                ->values()
                ->all();
        }

        $creator->fill($data)->save();

        if (isset($data['full_name'])) {
            $creator->user?->update(['name' => $data['full_name']]);
        }

        $queued = array_key_exists('socials', $data) && $this->socialMetrics->queue($creator->refresh(), true);

        return response()->json($this->creatorPayload($creator->fresh()->load(['user', 'portfolioVideos']), $queued));
    }

    public function refreshFollowers(Request $request): JsonResponse
    {
        $data = $request->validate([
            'creator_id' => ['required', 'integer', 'exists:creators,id'],
            'force' => ['sometimes', 'boolean'],
        ]);

        $creator = Creator::query()->findOrFail($data['creator_id']);
        $this->authorizeFollowerRefresh($request, $creator);

        $handles = $this->socialMetrics->storedHandles($creator);
        if ($handles === []) {
            return response()->json(['status' => 'skipped', 'reason' => 'none']);
        }

        $force = (bool) ($data['force'] ?? false);
        if (! $force && $this->socialMetrics->followersAreFresh($creator)) {
            return response()->json(['status' => 'skipped', 'reason' => 'fresh']);
        }

        return $this->queueCreatorSocialSync($creator, null, $handles, $force);
    }

    public function refreshFollowersStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'creator_id' => ['required', 'integer', 'exists:creators,id'],
        ]);

        $creator = Creator::query()->findOrFail($data['creator_id']);
        $this->authorizeFollowerRefresh($request, $creator);

        return $this->socialSyncJobResponse($creator, MetricsSyncStatus::creatorKey($creator->id));
    }

    public function syncSocials(Request $request, Creator $creator): JsonResponse
    {
        $this->authorizeCreator($request, $creator);

        $data = $request->validate([
            'network' => ['nullable', Rule::in(SocialMetricsService::NETWORKS)],
            'handle' => ['nullable', 'string', 'max:255'],
            'handles' => ['nullable', 'array'],
            'handles.instagram' => ['nullable', 'string', 'max:255'],
            'handles.tiktok' => ['nullable', 'string', 'max:255'],
            'handles.youtube' => ['nullable', 'string', 'max:255'],
            'force' => ['sometimes', 'boolean'],
        ]);

        $handles = $data['handles'] ?? [];
        if (($data['network'] ?? null) && array_key_exists('handle', $data)) {
            $handles[$data['network']] = $data['handle'];
        }

        $network = $data['network'] ?? null;

        return $this->queueCreatorSocialSync($creator, $network, $handles, (bool) ($data['force'] ?? false));
    }

    public function socialSyncStatus(Request $request, Creator $creator): JsonResponse
    {
        $this->authorizeCreator($request, $creator);

        $network = $request->string('network')->toString() ?: null;
        $key = MetricsSyncStatus::creatorKey($creator->id, $network);

        return $this->socialSyncJobResponse($creator, $key);
    }

    private function socialSyncJobResponse(Creator $creator, string $key): JsonResponse
    {
        $state = MetricsSyncStatus::get($key);
        if ($state === null) {
            return response()->json(['status' => MetricsSyncStatus::IDLE]);
        }

        $status = (string) ($state['status'] ?? MetricsSyncStatus::IDLE);

        if ($status === MetricsSyncStatus::FAILED) {
            return response()->json([
                'status' => $status,
                'message' => $state['message'] ?? __('auth.social_profile_unavailable'),
            ], 422);
        }

        if ($status !== MetricsSyncStatus::DONE) {
            return response()->json(['status' => $status], 202);
        }

        return response()->json([
            'status' => $status,
            'data' => new CreatorResource($creator->fresh()->load(['user', 'portfolioVideos'])),
            'sync' => $state['sync'] ?? [],
        ]);
    }

    public function approve(Request $request, Creator $creator): JsonResponse
    {
        $this->authorizeCreatorModeration($request, $creator);

        $creator->update(['status' => CreatorStatus::Active]);
        $this->syncCompanyLandingApproval($request, $creator);
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
            $this->mail->creatorApproved($creator->fresh(['user']));
        }

        return response()->json(['data' => new CreatorResource($creator->fresh()->load('user'))]);
    }

    public function reject(Request $request, Creator $creator): JsonResponse
    {
        $this->authorizeCreatorModeration($request, $creator);

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
            $this->mail->creatorRejected($creator->fresh(['user']), $request->string('reason')->toString() ?: null);
        }

        return response()->json(['data' => new CreatorResource($creator->fresh()->load('user'))]);
    }

    public function updatePassword(Request $request, Creator $creator): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:8'],
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

    public function destroy(Request $request, Creator $creator): JsonResponse
    {
        $user = $creator->user;
        abort_unless($user, 422, __('auth.creator_without_user'));
        abort_if($user->id === $request->user()?->id, 422, __('auth.cannot_remove_self'));

        $user->purgeAccount();

        return response()->json(['message' => __('auth.creator_account_removed')]);
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
        $data = SafeHttpUrl::validateFields($data, ['url']);

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

    /**
     * @return array<string, mixed>
     */
    private function landingPageForOrigin(Request $request, Creator $creator): CompanyLandingPage
    {
        $user = $request->user();
        abort_unless(in_array($user->role, [UserRole::Admin, UserRole::Company], true), 403, __('auth.forbidden'));

        $data = $request->validate([
            'company_landing_page_id' => ['required', 'integer', 'exists:company_landing_pages,id'],
        ]);
        $page = CompanyLandingPage::query()->findOrFail($data['company_landing_page_id']);

        if ($user->role === UserRole::Company) {
            $companyId = (int) $user->actingCompanyId();
            abort_unless($companyId > 0 && (int) $page->company_id === $companyId, 403, __('auth.forbidden'));
            abort_unless($creator->isAccessibleByCompany($companyId), 403, __('auth.profile_unavailable'));
        }

        return $page;
    }

    private function landingOriginRelations(): array
    {
        return [
            'landingPage:id,display_name,slug',
            'company:id,name',
        ];
    }

    /**
     * @return array{data: CreatorResource, social_sync?: string}
     */
    private function creatorPayload(Creator $creator, bool $queued): array
    {
        $payload = ['data' => new CreatorResource($creator)];

        if ($queued) {
            $payload['social_sync'] = 'queued';
        }

        return $payload;
    }

    /**
     * @param  array<string, string|null>  $handles
     */
    private function queueCreatorSocialSync(Creator $creator, ?string $network, array $handles, bool $force): JsonResponse
    {
        $key = MetricsSyncStatus::creatorKey($creator->id, $network);

        if (! MetricsSyncStatus::busy($key)) {
            MetricsSyncStatus::put($key, MetricsSyncStatus::QUEUED);
            $job = new SyncCreatorSocialsJob($creator->id, $network, $handles, $force);
            if (app()->runningUnitTests()) {
                dispatch_sync($job);
            } else {
                dispatch($job)->afterResponse();
            }
        }

        return $this->socialSyncJobResponse($creator, $key);
    }

    private function authorizeFollowerRefresh(Request $request, Creator $creator): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }

        if ($user->role === UserRole::Company) {
            $companyId = (int) $user->actingCompanyId();
            abort_unless($companyId > 0 && $creator->isAccessibleByCompany($companyId), 403, __('auth.forbidden'));

            return;
        }

        abort(403, __('auth.forbidden'));
    }

    private function authorizeCreator(Request $request, Creator $creator): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        abort_unless($user->role === UserRole::Creator && $user->creator?->id === $creator->id, 403, __('auth.forbidden'));
    }

    private function authorizeCreatorModeration(Request $request, Creator $creator): void
    {
        $user = $request->user();

        if ($user->role === UserRole::Admin) {
            abort_unless($user->hasPermission(Permission::CreatorsModerate), 403, __('auth.forbidden_permission'));

            return;
        }

        abort_unless($creator->canBeModeratedBy($user), 403, __('auth.forbidden'));
    }

    private function syncCompanyLandingApproval(Request $request, Creator $creator): void
    {
        $user = $request->user();
        if ($user?->role !== UserRole::Company) {
            return;
        }

        $companyId = (int) $user->actingCompanyId();
        if ($companyId <= 0) {
            return;
        }

        CompanyLandingSignup::query()
            ->where('company_id', $companyId)
            ->where('creator_id', $creator->id)
            ->where('status', '!=', LandingSignupStatus::Approved)
            ->update([
                'status' => LandingSignupStatus::Approved,
                'reviewed_at' => now(),
                'reviewed_by_user_id' => $user->id,
            ]);
    }
}
