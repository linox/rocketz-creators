<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminUserController extends Controller
{
    public function __construct(private readonly PermissionService $permissions) {}
    public function index(): JsonResponse
    {
        $users = User::query()->where('role', UserRole::Admin)->latest()->get();

        return response()->json(['data' => UserResource::collection($users)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => Str::lower($data['email']),
            'password' => $data['password'],
            'role' => UserRole::Admin,
        ]);
        $this->permissions->grantDefaults($user);

        return response()->json(['data' => new UserResource($user->load('permissionGrants'))], 201);
    }

    public function destroy(User $adminUser): JsonResponse
    {
        abort_unless($adminUser->role === UserRole::Admin, 422, __('auth.not_admin'));
        abort_if($adminUser->id === request()->user()?->id, 422, __('auth.cannot_remove_self'));
        $adminUser->delete();

        return response()->json(['message' => __('auth.admin_removed')]);
    }
}
