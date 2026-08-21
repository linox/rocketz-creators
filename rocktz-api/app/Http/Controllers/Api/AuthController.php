<?php

namespace App\Http\Controllers\Api;

use App\Enums\CompanyStatus;
use App\Enums\CreatorStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\CompleteGoogleProfileRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterCompanyRequest;
use App\Http\Requests\Auth\RegisterCreatorRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\UpdateLocaleRequest;
use App\Http\Resources\UserResource;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\User;
use App\Services\AuthService;
use App\Services\GoogleAuthService;
use App\Support\Geo;
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
    ) {}

    public function registerCreator(RegisterCreatorRequest $request): JsonResponse
    {
        $payload = $this->authService->registerCreator($request->validated(), $request);

        return response()->json($payload, 201);
    }

    public function registerCompany(RegisterCompanyRequest $request): JsonResponse
    {
        $payload = $this->authService->registerCompany($request->validated(), $request);

        return response()->json($payload, 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();
        $user = User::query()->where('email', Str::lower($credentials['email']))->first();

        if (! $user || ! $user->password || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => __('auth.invalid_credentials')], 422);
        }

        return response()->json($this->authService->issueToken($user));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => __('auth.logged_out')]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['creator', 'company', 'companyUser', 'permissionGrants']);

        return response()->json([
            'user' => new UserResource($user),
        ]);
    }

    public function updateLocale(UpdateLocaleRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['locale' => $request->validated('locale')])->save();
        $user->load(['creator', 'company', 'companyUser', 'permissionGrants']);

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

        $user->fill($data)->save();

        if (isset($data['name'])) {
            $user->creator?->update(['full_name' => $data['name']]);
        }

        if (array_key_exists('avatar_url', $data)) {
            $user->creator?->update(['photo_url' => $data['avatar_url']]);
            $user->company?->update(['logo_url' => $data['avatar_url']]);
        }

        $user->load(['creator', 'company', 'companyUser', 'permissionGrants']);

        return response()->json([
            'user' => new UserResource($user),
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        if (config('mail.default') === 'resend' && blank(config('services.resend.key'))) {
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
        $frontend = rtrim((string) config('app.frontend_url'), '/');
        $intent = $request->string('state')->toString() ?: 'login';

        if ($request->filled('error')) {
            return redirect()->away($frontend.'/login?error=google_cancelled');
        }

        try {
            $googleUser = $this->googleAuthService->userFromCode((string) $request->string('code'));
            $user = $this->googleAuthService->findOrNewUser($googleUser);
            $payload = $this->authService->issueToken($user);

            if ($this->googleAuthService->needsProfile($user)) {
                return redirect()->away(
                    $frontend.'/login?google=complete&intent='.urlencode($intent).'&token='.urlencode($payload['token'])
                );
            }

            return redirect()->away($frontend.'/auth/callback?token='.urlencode($payload['token']).($user->wasRecentlyCreated ? '&signup=1' : ''));
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

        return response()->json($this->authService->issueToken($user->fresh()));
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
            ]);
        });
    }
}
