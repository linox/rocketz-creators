<?php

namespace App\Http\Controllers\Api;

use App\Enums\CompanyStatus;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\User;
use App\Services\Mail\MailNotifier;
use App\Services\NotificationService;
use App\Services\PermissionService;
use App\Support\Geo;
use App\Support\SafeHttpUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CompanyController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly PermissionService $permissions,
        private readonly MailNotifier $mail,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $relations = [
            'favoriteCreators' => fn ($q) => $q->select('creators.id'),
        ];
        if ($user->role !== UserRole::Creator) {
            $relations[] = 'contacts';
        }
        $query = Company::query()->with($relations);

        if ($user->role === UserRole::Company) {
            $query->where('id', $user->companyUser?->company_id);
        } elseif ($user->role === UserRole::Creator) {
            $query->where('status', CompanyStatus::Active);
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($search = $request->string('q')->toString()) {
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('segment', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%");
            });
        }

        return response()->json(['data' => CompanyResource::collection($query->latest()->get())]);
    }

    public function show(Request $request, Company $company): JsonResponse
    {
        $this->assertCanViewCompany($request, $company);
        $user = $request->user();
        $with = ['favoriteCreators'];
        if ($user->role !== UserRole::Creator) {
            $with[] = 'contacts';
            $with[] = 'companyUsers.user';
        }
        $company->load($with);

        return response()->json(['data' => new CompanyResource($company)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'responsible_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email'],
            'whatsapp' => ['nullable', 'string', 'max:30'],
            'cnpj' => ['nullable', 'string', 'max:20'],
            'segment' => ['nullable', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => Geo::countryRules(false),
            'currency' => Geo::currencyRules(false),
            'observations' => ['nullable', 'string'],
            'objective' => ['nullable', 'string'],
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['nullable', Rule::enum(CompanyStatus::class)],
        ]);

        $data['country'] = Geo::normalizeCountry($data['country'] ?? Geo::DEFAULT_COUNTRY);
        $data['currency'] = Geo::normalizeCurrency($data['currency'] ?? Geo::defaultCurrency($data['country']));
        $data = SafeHttpUrl::validateFields($data, ['logo_url']);

        $company = Company::query()->create([
            ...$data,
            'status' => $data['status'] ?? CompanyStatus::Active,
        ]);

        return response()->json(['data' => new CompanyResource($company)], 201);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $this->assertCanManageCompany($request, $company);
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'responsible_name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email'],
            'whatsapp' => ['nullable', 'string', 'max:30'],
            'cnpj' => ['nullable', 'string', 'max:20'],
            'segment' => ['nullable', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => Geo::countryRules(false),
            'currency' => Geo::currencyRules(false),
            'observations' => ['nullable', 'string'],
            'objective' => ['nullable', 'string'],
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['nullable', Rule::enum(CompanyStatus::class)],
            'contacts' => ['nullable', 'array'],
            'contacts.*.name' => ['required_with:contacts', 'string'],
            'contacts.*.role' => ['nullable', 'string'],
            'contacts.*.email' => ['nullable', 'email'],
            'contacts.*.whatsapp' => ['nullable', 'string'],
        ]);

        if ($user->role !== UserRole::Admin) {
            unset($data['status']);
        }

        $data = SafeHttpUrl::validateFields($data, ['logo_url']);
        $contacts = $data['contacts'] ?? null;
        unset($data['contacts']);
        if (isset($data['country'])) {
            $data['country'] = Geo::normalizeCountry($data['country']);
            $data['currency'] = Geo::normalizeCurrency($data['currency'] ?? Geo::defaultCurrency($data['country']));
        } elseif (isset($data['currency'])) {
            $data['currency'] = Geo::normalizeCurrency($data['currency']);
        }
        $company->fill($data)->save();

        if (is_array($contacts)) {
            $company->contacts()->delete();
            foreach ($contacts as $contact) {
                $company->contacts()->create($contact);
            }
        }

        return response()->json(['data' => new CompanyResource($company->fresh()->load(['contacts', 'favoriteCreators']))]);
    }

    public function approve(Company $company): JsonResponse
    {
        $company->update(['status' => CompanyStatus::Active]);
        $company->companyUsers()->update(['status' => CompanyStatus::Active]);

        $company->companyUsers()->with('user')->get()->each(function (CompanyUser $companyUser) use ($company) {
            if ($companyUser->user_id) {
                $this->notifications->send([
                    'user_id' => $companyUser->user_id,
                    'title' => 'Empresa aprovada',
                    'message' => "{$company->name} foi aprovada e já pode criar campanhas.",
                    'type' => NotificationType::Approval,
                    'target_role' => NotificationTargetRole::Company,
                    'link' => '/company-dashboard',
                ]);
            }
        });

        $this->mail->companyApproved($company->fresh(['companyUsers.user']));

        return response()->json(['data' => new CompanyResource($company->fresh())]);
    }

    public function rotateInviteCode(Request $request, Company $company): JsonResponse
    {
        $this->assertCanManageCompany($request, $company);

        $company->rotateInviteCode();

        return response()->json([
            'data' => new CompanyResource($company->fresh()->load(['contacts', 'favoriteCreators'])),
        ]);
    }

    public function reject(Request $request, Company $company): JsonResponse
    {
        $company->update(['status' => CompanyStatus::Rejected]);
        $this->mail->companyRejected($company->fresh(['companyUsers.user']));

        return response()->json(['data' => new CompanyResource($company->fresh())]);
    }

    public function destroy(Company $company): JsonResponse
    {
        DB::transaction(function () use ($company) {
            $userIds = $company->companyUsers()->pluck('user_id')->filter()->all();
            $company->delete();
            if ($userIds !== []) {
                User::query()->whereIn('id', $userIds)->delete();
            }
        });

        return response()->json(['message' => __('auth.company_removed')]);
    }

    public function toggleFavorite(Request $request, Company $company, Creator $creator): JsonResponse
    {
        $this->assertCanManageCompany($request, $company);
        $user = $request->user();

        $alreadyFavorited = $company->favoriteCreators()->where('creators.id', $creator->id)->exists();
        if ($user->role === UserRole::Company && ! $alreadyFavorited && ! $creator->isInCompanyPool((int) $company->id)) {
            return response()->json(['message' => __('auth.creator_not_in_company_pool')], 403);
        }

        $company->favoriteCreators()->toggle([$creator->id]);

        return response()->json([
            'data' => new CompanyResource($company->fresh()->load('favoriteCreators')),
        ]);
    }

    public function storeUser(Request $request, Company $company): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'can_publish_without_approval' => ['sometimes', 'boolean'],
        ]);

        $row = DB::transaction(function () use ($data, $company) {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'role' => UserRole::Company,
            ]);

            $row = CompanyUser::query()->create([
                'user_id' => $user->id,
                'company_id' => $company->id,
                'status' => $company->status,
                'can_publish_without_approval' => (bool) ($data['can_publish_without_approval'] ?? false),
            ]);

            $this->permissions->sync(
                $user,
                $row->can_publish_without_approval ? [Permission::CampaignsPublishWithoutApproval->value] : [],
            );

            return $row;
        });

        return response()->json(['data' => $row->load('user')], 201);
    }

    public function updateUser(Request $request, Company $company, CompanyUser $companyUser): JsonResponse
    {
        if ($companyUser->company_id !== $company->id) {
            return response()->json(['message' => __('auth.forbidden')], 404);
        }

        $data = $request->validate([
            'can_publish_without_approval' => ['required', 'boolean'],
        ]);
        $companyUser->update($data);
        if ($companyUser->user) {
            $this->permissions->sync(
                $companyUser->user,
                $companyUser->can_publish_without_approval ? [Permission::CampaignsPublishWithoutApproval->value] : [],
            );
        }

        return response()->json(['data' => $companyUser->fresh()->load('user')]);
    }

    public function destroyUser(Company $company, CompanyUser $companyUser): JsonResponse
    {
        if ($companyUser->company_id !== $company->id) {
            return response()->json(['message' => __('auth.forbidden')], 404);
        }

        $companyUser->delete();

        return response()->json(['message' => __('auth.company_user_removed')]);
    }

    private function assertCanViewCompany(Request $request, Company $company): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        if ($user->role === UserRole::Company && $user->companyUser?->company_id === $company->id) {
            return;
        }
        if ($user->role === UserRole::Creator && $company->status === CompanyStatus::Active) {
            return;
        }
        abort(403, __('auth.forbidden'));
    }

    private function assertCanManageCompany(Request $request, Company $company): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        if ($user->role === UserRole::Company && $user->companyUser?->company_id === $company->id) {
            return;
        }
        abort(403, __('auth.forbidden'));
    }
}
