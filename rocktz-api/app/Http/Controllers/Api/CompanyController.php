<?php

namespace App\Http\Controllers\Api;

use App\Enums\CompanyStatus;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CompanyController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Company::query()->with(['contacts', 'favoriteCreators']);

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
        $user = $request->user();
        if ($user->role === UserRole::Company && $user->companyUser?->company_id !== $company->id) {
            return response()->json(['message' => __('auth.forbidden')], 403);
        }

        $company->load(['contacts', 'favoriteCreators', 'companyUsers.user']);

        return response()->json(['data' => new CompanyResource($company)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'responsible_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email'],
            'whatsapp' => ['nullable', 'string', 'max:30'],
            'cnpj' => ['nullable', 'string', 'max:20'],
            'segment' => ['nullable', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'objective' => ['nullable', 'string'],
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['nullable', Rule::enum(CompanyStatus::class)],
        ]);

        $company = Company::query()->create([
            ...$data,
            'status' => $data['status'] ?? CompanyStatus::Pending,
        ]);

        return response()->json(['data' => new CompanyResource($company)], 201);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $user = $request->user();
        if ($user->role === UserRole::Company && $user->companyUser?->company_id !== $company->id) {
            return response()->json(['message' => __('auth.forbidden')], 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'responsible_name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email'],
            'whatsapp' => ['nullable', 'string', 'max:30'],
            'cnpj' => ['nullable', 'string', 'max:20'],
            'segment' => ['nullable', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
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

        $contacts = $data['contacts'] ?? null;
        unset($data['contacts']);
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

        return response()->json(['data' => new CompanyResource($company->fresh())]);
    }

    public function reject(Request $request, Company $company): JsonResponse
    {
        $company->update(['status' => CompanyStatus::Rejected]);

        return response()->json(['data' => new CompanyResource($company->fresh())]);
    }

    public function toggleFavorite(Request $request, Company $company, Creator $creator): JsonResponse
    {
        $user = $request->user();
        if ($user->role === UserRole::Company && $user->companyUser?->company_id !== $company->id) {
            return response()->json(['message' => __('auth.forbidden')], 403);
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
            'password' => ['required', 'string', 'min:6'],
        ]);

        $row = DB::transaction(function () use ($data, $company) {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'role' => UserRole::Company,
            ]);

            return CompanyUser::query()->create([
                'user_id' => $user->id,
                'company_id' => $company->id,
                'status' => $company->status,
            ]);
        });

        return response()->json(['data' => $row->load('user')], 201);
    }
}
