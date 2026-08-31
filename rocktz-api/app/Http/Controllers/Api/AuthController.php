<?php

namespace App\Http\Controllers\Api;

use App\Enums\CompanyStatus;
use App\Enums\CreatorStatus;
use App\Enums\TwoFactorPurpose;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\CompleteGoogleProfileRequest;
use App\Http\Requests\Auth\DisableTwoFactorRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterCompanyRequest;
use App\Http\Requests\Auth\RegisterCreatorRequest;
use App\Http\Requests\Auth\ResendTwoFactorRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\UpdateLocaleRequest;
use App\Http\Requests\Auth\VerifyTwoFactorRequest;
use App\Http\Resources\UserResource;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\AuthService;
use App\Services\CompanyLandingService;
use App\Services\GoogleAuthService;
use App\Services\Mail\MailNotifier;
use App\Services\Mail\TransactionalMailService;
use App\Services\TwoFactorService;
use App\Support\FrontendUrl;
use App\Support\Geo;
use App\Support\SafeHttpUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use RuntimeException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly GoogleAuthService $googleAuthService,
        private readonly TwoFactorService $twoFactorService,
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function registerCreator(RegisterCreatorRequest $request): JsonResponse
    {
        $payload = $this->authService->registerCreator($request->validated(), $request);
        $this->logAccess($request, 'register.creator', $this->userFromPayload($payload), 201);

        return response()->json($payload, 201);
    }

    public function registerCompany(RegisterCompanyRequest $request): JsonResponse
    {
        $payload = $this->authService->registerCompany($request->validated(), $request);
        $this->logAccess($request, 'register.company', $this->userFromPayload($payload), 201);

        return response()->json($payload, 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();
        $user = User::query()->where('email', Str::lower($credentials['email']))->first();

        if (! $user || ! $user->password || ! Hash::check($credentials['password'], $user->password)) {
            $this->logAccess($request, 'login.failed', $user, 422, ['email' => Str::lower($credentials['email'])]);

            return response()->json(['message' => __('auth.invalid_credentials')], 422);
        }

        if ($user->two_factor_enabled) {
            $this->logAccess($request, 'login.two_factor', $user);

            return $this->twoFactorJson(fn () => $this->twoFactorService->startChallenge($user, TwoFactorPurpose::Login));
        }

        $this->logAccess($request, 'login.success', $user);

        return response()->json($this->authService->issueToken($user));
    }

    public function verifyTwoFactor(VerifyTwoFactorRequest $request): JsonResponse
    {
        return $this->twoFactorJson(function () use ($request) {
            $user = $this->twoFactorService->verify(
                $request->validated('challenge_token'),
                $request->validated('code'),
                TwoFactorPurpose::Login,
            );
            $this->logAccess($request, 'login.success', $user, 200, ['two_factor' => true]);

            return $this->authService->issueToken($user);
        });
    }

    public function resendTwoFactor(ResendTwoFactorRequest $request): JsonResponse
    {
        return $this->twoFactorJson(fn () => $this->twoFactorService->resend($request->validated('challenge_token')));
    }

    public function enableTwoFactor(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->refresh();
        if ($user->two_factor_enabled) {
            return response()->json(['message' => __('auth.two_factor_already_enabled')], 422);
        }

        return $this->twoFactorJson(fn () => $this->twoFactorService->startChallenge($user, TwoFactorPurpose::Enable));
    }

    public function confirmTwoFactor(VerifyTwoFactorRequest $request): JsonResponse
    {
        return $this->twoFactorJson(function () use ($request) {
            $user = $this->twoFactorService->verify(
                $request->validated('challenge_token'),
                $request->validated('code'),
                TwoFactorPurpose::Enable,
            );
            if ($user->isNot($request->user())) {
                throw new RuntimeException(__('auth.two_factor_invalid'), 422);
            }
            $user->forceFill(['two_factor_enabled' => true])->save();
            $request->user()?->forceFill(['two_factor_enabled' => true]);
            $user->loadAuthRelations();
            $this->logAccess($request, 'two_factor.enabled', $user);

            return [
                'message' => __('auth.two_factor_enabled'),
                'user' => new UserResource($user),
            ];
        });
    }

    public function disableTwoFactorChallenge(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->refresh();
        if (! $user->two_factor_enabled) {
            return response()->json(['message' => __('auth.two_factor_not_enabled')], 422);
        }

        return $this->twoFactorJson(fn () => $this->twoFactorService->startChallenge($user, TwoFactorPurpose::Disable));
    }

    public function disableTwoFactor(DisableTwoFactorRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->refresh();
        if (! $user->two_factor_enabled) {
            return response()->json(['message' => __('auth.two_factor_not_enabled')], 422);
        }

        $data = $request->validated();

        if (filled($data['password'] ?? null)) {
            if (! $user->password || ! Hash::check($data['password'], $user->password)) {
                return response()->json(['message' => __('auth.password')], 422);
            }
        } elseif (filled($data['challenge_token'] ?? null) && filled($data['code'] ?? null)) {
            try {
                $verified = $this->twoFactorService->verify($data['challenge_token'], $data['code'], TwoFactorPurpose::Disable);
                if ($verified->isNot($user)) {
                    return response()->json(['message' => __('auth.two_factor_invalid')], 422);
                }
            } catch (RuntimeException $e) {
                return $this->twoFactorException($e);
            }
        } else {
            return response()->json(['message' => __('auth.two_factor_disable_required')], 422);
        }

        $user->forceFill(['two_factor_enabled' => false])->save();
        $user->twoFactorChallenges()->delete();
        $user->loadAuthRelations();
        $this->logAccess($request, 'two_factor.disabled', $user);

        return response()->json([
            'message' => __('auth.two_factor_disabled'),
            'user' => new UserResource($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->logAccess($request, 'logout', $request->user());
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => __('auth.logged_out')]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadAuthRelations();

        return response()->json([
            'user' => new UserResource($user),
        ]);
    }

    public function acceptLgpd(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authService->recordLgpdConsent($user, $request);
        $user->loadAuthRelations();

        return response()->json([
            'user' => new UserResource($user),
        ]);
    }

    public function switchCompany(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === UserRole::Company, 403, __('auth.forbidden'));

        $data = $request->validate([
            'company_id' => ['required', 'integer', 'exists:companies,id'],
        ]);

        $user->switchActiveCompany((int) $data['company_id']);
        $user->loadAuthRelations();
        $this->logAccess($request, 'company.switch', $user, 200, ['company_id' => (int) $data['company_id']]);

        return response()->json([
            'message' => __('auth.company_switched'),
            'user' => new UserResource($user),
        ]);
    }

    public function updateLocale(UpdateLocaleRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['locale' => $request->validated('locale')])->save();
        $user->loadAuthRelations();

        return response()->json([
            'message' => __('auth.locale_updated'),
            'user' => new UserResource($user),
        ]);
    }

    public function updateMe(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
        ]);
        $data = SafeHttpUrl::validateFields($data, ['avatar_url']);

        $user->fill($data)->save();
        $this->logAccess($request, 'profile.update', $user);

        if (isset($data['name'])) {
            $user->creator?->update(['full_name' => $data['name']]);
        }

        if (array_key_exists('avatar_url', $data)) {
            $user->creator?->update(['photo_url' => $data['avatar_url']]);
            $user->company?->update(['logo_url' => $data['avatar_url']]);
        }

        $user->loadAuthRelations();

        return response()->json([
            'user' => new UserResource($user),
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        if (! app(TransactionalMailService::class)->providerConfigured()) {
            return response()->json(['message' => __('auth.mail_not_configured')], 503);
        }

        $email = Str::lower($request->validated('email'));

        try {
            $status = Password::sendResetLink(['email' => $email]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => __('auth.mail_failed')], 503);
        }

        if ($status === Password::RESET_THROTTLED) {
            return response()->json(['message' => __('auth.mail_throttled')], 429);
        }

        $this->logAccess($request, 'password.reset_requested', User::query()->where('email', $email)->first(), 200, ['email' => $email]);

        return response()->json([
            'message' => __('auth.reset_sent'),
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset($request->validated(), function (User $user, string $password) {
            $user->forceFill([
                'password' => $password,
            ])->save();
        });

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => __('auth.reset_invalid')], 422);
        }

        $resetUser = User::query()->where('email', Str::lower($request->validated('email')))->first();
        $this->logAccess($request, 'password.reset', $resetUser);

        return response()->json(['message' => __('auth.reset_success')]);
    }

    public function googleRedirect(Request $request): JsonResponse|RedirectResponse
    {
        $intent = $request->string('intent')->toString() ?: 'login';

        if (! in_array($intent, ['login', 'creator', 'company'], true)) {
            $intent = 'login';
        }

        try {
            $url = $this->googleAuthService->redirectUrl($intent);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        if ($request->boolean('json')) {
            return response()->json(['url' => $url]);
        }

        return redirect()->away($url);
    }

    public function googleCallback(Request $request): RedirectResponse
    {
        $frontend = FrontendUrl::origin();

        if ($request->filled('error')) {
            return redirect()->away($frontend.'/login?error=google_cancelled');
        }

        try {
            $intent = $this->googleAuthService->consumeState($request->string('state')->toString() ?: null);
            $googleUser = $this->googleAuthService->userFromCode((string) $request->string('code'));
            $user = $this->googleAuthService->findOrNewUser($googleUser);

            if ($this->googleAuthService->needsProfile($user)) {
                $payload = $this->authService->issueToken($user);

                return redirect()->away($frontend.'/login#'.http_build_query([
                    'google' => 'complete',
                    'intent' => $intent,
                    'token' => $payload['token'],
                ]));
            }

            if ($user->two_factor_enabled) {
                $this->logAccess($request, 'login.two_factor', $user, 200, ['provider' => 'google']);
                $challenge = $this->twoFactorService->startChallenge($user, TwoFactorPurpose::Login);

                return redirect()->away($frontend.'/login#'.http_build_query([
                    'two_factor' => '1',
                    'challenge' => $challenge['challenge_token'],
                    'email_hint' => $challenge['email_hint'],
                ]));
            }

            $payload = $this->authService->issueToken($user);
            $this->logAccess($request, $user->wasRecentlyCreated ? 'register.creator' : 'login.success', $user, 200, ['provider' => 'google']);
            $fragment = ['token' => $payload['token']];
            if ($user->wasRecentlyCreated) {
                $fragment['signup'] = '1';
            }

            return redirect()->away($frontend.'/auth/callback#'.http_build_query($fragment));
        } catch (RuntimeException $e) {
            return redirect()->away($frontend.'/login?error=google_failed');
        }
    }

    public function completeGoogleProfile(CompleteGoogleProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        if (! $this->googleAuthService->needsProfile($user)) {
            return response()->json($this->authService->issueToken($user->fresh()));
        }

        $this->attachGoogleProfile($user, $data['type'], $request);
        if (! empty($data['locale'])) {
            $user->forceFill(['locale' => $data['locale']])->save();
        }
        $this->authService->recordLgpdConsent($user, $request);

        $fresh = $user->fresh(['creator', 'company']);
        $this->authService->safelyNotify(function () use ($data, $fresh) {
            if ($data['type'] === 'creator') {
                app(MailNotifier::class)->creatorRegistered($fresh);
            } else {
                app(MailNotifier::class)->companyRegistered($fresh);
            }
        });

        $this->logAccess($request, $data['type'] === 'creator' ? 'register.creator' : 'register.company', $fresh, 200, ['provider' => 'google']);

        return response()->json($this->authService->issueToken($fresh));
    }

    /**
     * @param  callable(): array<string, mixed>  $callback
     */
    private function twoFactorJson(callable $callback): JsonResponse
    {
        try {
            return response()->json($callback());
        } catch (RuntimeException $e) {
            return $this->twoFactorException($e);
        }
    }

    private function twoFactorException(RuntimeException $e): JsonResponse
    {
        $status = $e->getCode();
        if (! is_int($status) || $status < 400 || $status > 599) {
            $status = 422;
        }

        return response()->json(['message' => $e->getMessage()], $status);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function userFromPayload(array $payload): ?User
    {
        $resource = $payload['user'] ?? null;
        if ($resource instanceof UserResource) {
            $model = $resource->resource;

            return $model instanceof User ? $model : null;
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $properties
     */
    private function logAccess(Request $request, string $action, ?User $user = null, int $status = 200, array $properties = []): void
    {
        $category = $action === 'profile.update' ? 'action' : 'access';
        $this->activityLogger->record($request, $action, $category, $user, $properties, $status);
    }

    private function attachGoogleProfile(User $user, string $type, Request $request): void
    {
        DB::transaction(function () use ($user, $type, $request) {
            if ($type === 'company') {
                $user->forceFill([
                    'role' => UserRole::Company,
                    'name' => $request->input('responsible_name', $user->name),
                ])->save();

                $company = Company::query()->create([
                    'name' => $request->input('name', $user->name),
                    'cnpj' => $request->input('cnpj'),
                    'segment' => $request->input('segment'),
                    'responsible_name' => $request->input('responsible_name', $user->name),
                    'whatsapp' => $request->input('whatsapp'),
                    'email' => $user->email,
                    'city' => $request->input('city'),
                    'country' => Geo::normalizeCountry($request->input('country', Geo::DEFAULT_COUNTRY)),
                    'currency' => Geo::normalizeCurrency($request->input('currency', Geo::defaultCurrency($request->input('country')))),
                    'objective' => $request->input('objective'),
                    'status' => CompanyStatus::Pending,
                ]);

                CompanyUser::query()->create([
                    'user_id' => $user->id,
                    'company_id' => $company->id,
                    'status' => CompanyStatus::Pending,
                ]);

                return;
            }

            $artisticName = ltrim((string) $request->input('artistic_name', $user->name), '@');
            $instagram = ltrim((string) $request->input('instagram', ''), '@');

            $user->forceFill([
                'role' => UserRole::Creator,
                'name' => $request->input('full_name', $user->name),
            ])->save();

            Creator::query()->create([
                'user_id' => $user->id,
                'full_name' => $request->input('full_name', $user->name),
                'artistic_name' => $artisticName,
                'whatsapp' => $request->input('whatsapp'),
                'city' => $request->input('city'),
                'country' => Geo::normalizeCountry($request->input('country', Geo::DEFAULT_COUNTRY)),
                'state' => $request->input('state') ? Geo::normalizeRegion((string) $request->input('state')) : null,
                'socials' => ['instagram' => $instagram],
                'metrics' => ['followers' => 0, 'avgViews' => 0, 'avgEngagement' => 0],
                'categories' => [$request->input('category', 'UGC Content')],
                'pricing' => [],
                'status' => CreatorStatus::Review,
                'internal_notes' => 'Auto-cadastrado via Google.',
                'invited_by_company_id' => Company::findActiveByInviteCode($request->input('invite_code'))?->id,
            ]);
        });

        if ($type === 'creator' && filled($request->input('landing_slug'))) {
            $user->load('creator');
            if ($user->creator) {
                app(CompanyLandingService::class)->attributeCreator(
                    (string) $request->input('landing_slug'),
                    $user->creator,
                );
            }
        }
    }
}
