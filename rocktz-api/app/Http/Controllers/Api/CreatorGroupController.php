<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CreatorGroupResource;
use App\Models\Company;
use App\Models\Creator;
use App\Models\CreatorGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CreatorGroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = CreatorGroup::query()
            ->with(['company:id,name', 'creators'])
            ->withCount('creators')
            ->orderBy('name');

        if ($user->role === UserRole::Company) {
            $companyId = (int) $user->actingCompanyId();
            abort_unless($companyId, 403, __('auth.company_not_linked'));
            $query->where('company_id', $companyId);
        } elseif ($request->filled('company_id')) {
            $query->where('company_id', $request->integer('company_id'));
        }

        return response()->json([
            'data' => CreatorGroupResource::collection($query->get()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'company_id' => [$user->role === UserRole::Admin ? 'required' : 'nullable', 'integer', 'exists:companies,id'],
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $companyId = $user->role === UserRole::Company
            ? (int) $user->actingCompanyId()
            : (int) $data['company_id'];
        abort_unless($companyId, 422, __('auth.company_not_linked'));
        if ($user->role === UserRole::Company) {
            abort_unless($user->belongsToCompany($companyId), 403, __('auth.forbidden'));
        }
        Company::assertApproved($companyId);

        $group = CreatorGroup::query()->create([
            'company_id' => $companyId,
            'name' => trim($data['name']),
            'description' => filled($data['description'] ?? null) ? trim((string) $data['description']) : null,
        ]);
        $group->load(['company:id,name', 'creators'])->loadCount('creators');

        return response()->json(['data' => new CreatorGroupResource($group)], 201);
    }

    public function update(Request $request, CreatorGroup $creatorGroup): JsonResponse
    {
        $this->assertCanManage($request, $creatorGroup);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);
        if (array_key_exists('name', $data)) {
            $creatorGroup->name = trim((string) $data['name']);
        }
        if (array_key_exists('description', $data)) {
            $creatorGroup->description = filled($data['description']) ? trim((string) $data['description']) : null;
        }
        $creatorGroup->save();

        return response()->json(['data' => new CreatorGroupResource($this->present($creatorGroup))]);
    }

    public function destroy(Request $request, CreatorGroup $creatorGroup): JsonResponse
    {
        $this->assertCanManage($request, $creatorGroup);
        $creatorGroup->delete();

        return response()->json(['message' => __('auth.creator_group_removed')]);
    }

    public function attachMember(Request $request, CreatorGroup $creatorGroup): JsonResponse
    {
        $this->assertCanManage($request, $creatorGroup);
        $data = $request->validate([
            'creator_id' => ['required', 'integer', 'exists:creators,id'],
        ]);
        $creator = Creator::query()->findOrFail($data['creator_id']);
        abort_unless(
            $creator->isInCompanyPool((int) $creatorGroup->company_id),
            422,
            __('auth.creator_not_in_company_pool'),
        );
        $creatorGroup->creators()->syncWithoutDetaching([$creator->id]);

        return response()->json(['data' => new CreatorGroupResource($this->present($creatorGroup))]);
    }

    public function detachMember(Request $request, CreatorGroup $creatorGroup, Creator $creator): JsonResponse
    {
        $this->assertCanManage($request, $creatorGroup);
        $creatorGroup->creators()->detach($creator->id);

        return response()->json(['data' => new CreatorGroupResource($this->present($creatorGroup))]);
    }

    private function present(CreatorGroup $group): CreatorGroup
    {
        return $group->fresh()->load(['company:id,name', 'creators'])->loadCount('creators');
    }

    private function assertCanManage(Request $request, CreatorGroup $group): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        if ($user->role === UserRole::Company && $user->belongsToCompany((int) $group->company_id)) {
            return;
        }
        abort(403, __('auth.forbidden'));
    }
}
