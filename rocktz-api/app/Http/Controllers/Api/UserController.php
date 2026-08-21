<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function __construct(private readonly PermissionService $permissions) {}

    public function index(Request $request): JsonResponse
    {
        $query = User::query()
            ->with(['creator', 'company', 'companyUser', 'permissionGrants'])
            ->latest();

        if ($role = $request->string('role')->toString()) {
            $query->where('role', $role);
        }

        if ($search = $request->string('q')->toString()) {
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%');
            });
        }

        return response()->json(['data' => UserResource::collection($query->get())]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', Rule::enum(UserRole::class), Rule::in([UserRole::Admin->value, UserRole::Company->value])],
            'company_id' => ['exclude_unless:role,'.UserRole::Company->value, 'required', 'exists:companies,id'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);

        $role = UserRole::from($data['role']);
        $user = DB::transaction(function () use ($data, $role) {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'role' => $role,
            ]);

            if ($role === UserRole::Company) {
                $company = Company::query()->findOrFail($data['company_id']);
                CompanyUser::query()->create([
                    'user_id' => $user->id,
                    'company_id' => $company->id,
                    'status' => $company->status,
                    'can_publish_without_approval' => false,
                ]);
            }

            $slugs = array_key_exists('permissions', $data)
                ? array_map(fn ($slug) => (string) $slug, $data['permissions'] ?? [])
                : Permission::slugsForRole($role);
            $this->permissions->sync($user, $slugs);

            return $user;
        });

        return response()->json([
            'data' => new UserResource($user->load(['creator', 'company', 'companyUser', 'permissionGrants'])),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string'],
            'password' => ['nullable', 'string', 'min:6'],
        ]);

        if (array_key_exists('permissions', $data)) {
            $slugs = array_map(fn ($slug) => (string) $slug, $data['permissions'] ?? []);
            if (
                $user->id === $request->user()?->id
                && $user->role === UserRole::Admin
                && ! in_array(Permission::UsersManage->value, $slugs, true)
            ) {
                abort(422, __('auth.cannot_remove_own_permission'));
            }
            $this->permissions->sync($user, $slugs);
        }

        if (! empty($data['password'])) {
            $user->forceFill(['password' => $data['password']])->save();
        }

        return response()->json([
            'data' => new UserResource($user->fresh()->load(['creator', 'company', 'companyUser', 'permissionGrants'])),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        abort_if($user->id === $request->user()?->id, 422, __('auth.cannot_remove_self'));
        abort_if($user->role === UserRole::Creator, 422, __('auth.cannot_remove_creator_user'));

        DB::transaction(function () use ($user) {
            $user->companyUser?->delete();
            $user->delete();
        });

        return response()->json(['message' => __('auth.user_removed')]);
    }
}
