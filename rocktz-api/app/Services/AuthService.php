<?php

namespace App\Services;

use App\Enums\CompanyStatus;
use App\Enums\ConsentType;
use App\Enums\CreatorStatus;
use App\Enums\UserRole;
use App\Http\Resources\UserResource;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Consent;
use App\Models\Creator;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuthService
{
    /**
     * @param  array<string, mixed>  $data
     * @return array{token: string, user: UserResource}
     */
    public function registerCreator(array $data, Request $request): array
    {
        $artisticName = ltrim(trim((string) $data['artistic_name']), '@');
        $instagram = ltrim(trim((string) $data['instagram']), '@');
        $category = $data['category'] ?? 'UGC Content';

        $user = DB::transaction(function () use ($data, $request, $artisticName, $instagram, $category) {
            $user = User::query()->create([
                'name' => $data['full_name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'role' => UserRole::Creator,
            ]);

            Creator::query()->create([
                'user_id' => $user->id,
                'full_name' => $data['full_name'],
                'artistic_name' => $artisticName,
                'whatsapp' => $data['whatsapp'],
                'city' => $data['city'],
                'state' => Str::upper($data['state']),
                'socials' => [
                    'instagram' => $instagram,
                ],
                'metrics' => [
                    'followers' => 0,
                    'avgViews' => 0,
                    'avgEngagement' => 0,
                ],
                'categories' => [$category],
                'pricing' => [],
                'accepts_exchange' => true,
                'accepts_paid_traffic' => true,
                'accepts_exclusivity' => false,
                'internal_notes' => 'Auto-cadastrado via plataforma.',
                'status' => CreatorStatus::Review,
            ]);

            $this->recordLgpdConsent($user, $request);

            return $user;
        });

        return $this->issueToken($user);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{token: string, user: UserResource}
     */
    public function registerCompany(array $data, Request $request): array
    {
        $user = DB::transaction(function () use ($data, $request) {
            $user = User::query()->create([
                'name' => $data['responsible_name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'role' => UserRole::Company,
            ]);

            $company = Company::query()->create([
                'name' => $data['name'],
                'cnpj' => $data['cnpj'] ?? null,
                'segment' => $data['segment'] ?? null,
                'responsible_name' => $data['responsible_name'],
                'whatsapp' => $data['whatsapp'],
                'email' => Str::lower($data['email']),
                'city' => $data['city'] ?? null,
                'objective' => $data['objective'] ?? null,
                'status' => CompanyStatus::Pending,
            ]);

            CompanyUser::query()->create([
                'user_id' => $user->id,
                'company_id' => $company->id,
                'status' => CompanyStatus::Pending,
            ]);

            $this->recordLgpdConsent($user, $request);

            return $user;
        });

        return $this->issueToken($user);
    }

    /**
     * @return array{token: string, user: UserResource}
     */
    public function issueToken(User $user): array
    {
        $user->load(['creator', 'company']);
        $token = $user->createToken('auth')->plainTextToken;

        return [
            'token' => $token,
            'user' => new UserResource($user),
        ];
    }

    public function recordLgpdConsent(User $user, Request $request): Consent
    {
        return Consent::query()->create([
            'user_id' => $user->id,
            'type' => ConsentType::LgpdSignup,
            'accepted_at' => now(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
}
