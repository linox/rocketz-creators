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
use App\Http\Resources\UserResource;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\User;
use App\Services\AuthService;
use App\Services\GoogleAuthService;
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
            return response()->json(['message' => 'E-mail ou senha incorretos.'], 422);
        }

        return response()->json($this->authService->issueToken($user));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Sessão encerrada.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['creator', 'company']);

        return response()->json([
            'user' => new UserResource($user),
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        Password::sendResetLink($request->validated());

        return response()->json([
            'message' => 'Se o e-mail existir, enviaremos o link de redefinição.',
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
            return response()->json(['message' => 'Token de redefinição inválido ou expirado.'], 422);
        }

        return response()->json(['message' => 'Senha redefinida com sucesso.']);
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

            return redirect()->away($frontend.'/api/auth/callback?token='.urlencode($payload['token']));
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
                'state' => $request->input('state') ? Str::upper((string) $request->input('state')) : null,
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
