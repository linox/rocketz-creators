<?php

namespace App\Http\Controllers\Api;

use App\Enums\ContentPlanningStatus;
use App\Enums\ContentType;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\RecurringContractStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\ContentPlanningItemResource;
use App\Http\Resources\RecurringContractResource;
use App\Models\ContentPlanningItem;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RecurringContractController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function index(Request $request): JsonResponse
    {
        $query = RecurringContract::query()
            ->with(['company', 'recurringContractCreators.creator', 'contentPlanningItems.creator', 'contentPlanningItems.company']);

        $user = $request->user();
        if ($user->role === UserRole::Company) {
            $query->where('company_id', $user->companyUser?->company_id);
        } elseif ($user->role === UserRole::Creator) {
            $query->whereHas('recurringContractCreators', fn ($q) => $q->where('creator_id', $user->creator?->id));
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        return response()->json(['data' => RecurringContractResource::collection($query->latest()->get())]);
    }

    public function show(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $this->assertCanView($request, $recurringContract);
        $recurringContract->load(['company', 'recurringContractCreators.creator', 'contentPlanningItems.creator', 'contentPlanningItems.company']);

        return response()->json(['data' => new RecurringContractResource($recurringContract)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => [$request->user()->role === UserRole::Admin ? 'required' : 'nullable', 'exists:companies,id'],
            'title' => ['required', 'string', 'max:255'],
            'objective' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(RecurringContractStatus::class)],
            'monthly_fee' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string'],
            'creator_ids' => ['nullable', 'array'],
            'creator_ids.*' => ['exists:creators,id'],
        ]);

        if ($request->user()->role === UserRole::Company) {
            $data['company_id'] = $request->user()->companyUser?->company_id;
        }

        abort_unless($data['company_id'] ?? null, 422, __('auth.company_not_linked'));

        $ids = $data['creator_ids'] ?? [];
        unset($data['creator_ids']);
        $data['status'] ??= RecurringContractStatus::Active;
        $contract = RecurringContract::query()->create($data);
        foreach ($ids as $creatorId) {
            $contract->recurringContractCreators()->create(['creator_id' => $creatorId]);
        }

        return response()->json(['data' => new RecurringContractResource($contract->load(['company', 'recurringContractCreators.creator']))], 201);
    }

    public function reset(): JsonResponse
    {
        $deleted = RecurringContract::query()->count();
        RecurringContract::query()->delete();

        return response()->json(['message' => __('auth.recurring_reset'), 'deleted' => $deleted]);
    }

    public function update(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'objective' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(RecurringContractStatus::class)],
            'monthly_fee' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string'],
        ]);
        $recurringContract->fill($data)->save();

        return response()->json(['data' => new RecurringContractResource($recurringContract->fresh()->load(['company', 'recurringContractCreators.creator']))]);
    }

    public function destroy(RecurringContract $recurringContract): JsonResponse
    {
        $recurringContract->delete();

        return response()->json(['message' => __('auth.contract_removed')]);
    }

    public function attachCreator(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $data = $request->validate([
            'creator_id' => ['required', 'exists:creators,id'],
            'monthly_fee' => ['nullable', 'numeric'],
            'monthly_cache' => ['nullable', 'numeric'],
            'monthly_deliverables' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
        ]);
        $row = $recurringContract->recurringContractCreators()->updateOrCreate(
            ['creator_id' => $data['creator_id']],
            $data,
        );

        return response()->json(['data' => $row->load('creator')], 201);
    }

    public function detachCreator(RecurringContract $recurringContract, RecurringContractCreator $recurringContractCreator): JsonResponse
    {
        abort_unless($recurringContractCreator->recurring_contract_id === $recurringContract->id, 404);
        $recurringContractCreator->delete();

        return response()->json(['message' => __('auth.recurring_creator_removed')]);
    }

    public function storeItem(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $data = $request->validate([
            'creator_id' => ['required', 'exists:creators,id'],
            'month' => ['required', 'string', 'max:7'],
            'content_type' => ['required', Rule::enum(ContentType::class)],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'briefing' => ['nullable', 'string'],
            'planned_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(ContentPlanningStatus::class)],
        ]);

        $item = $recurringContract->contentPlanningItems()->create([
            ...$data,
            'company_id' => $recurringContract->company_id,
            'status' => $data['status'] ?? ContentPlanningStatus::Planned,
        ]);

        $creator = $item->creator;
        if ($creator?->user_id) {
            $this->notifications->send([
                'user_id' => $creator->user_id,
                'creator_id' => $creator->id,
                'recurring_contract_id' => $recurringContract->id,
                'title' => 'Nova pauta',
                'message' => "Uma pauta foi adicionada em {$recurringContract->title}.",
                'type' => NotificationType::Contract,
                'target_role' => NotificationTargetRole::Creator,
                'link' => '/recurring/'.$recurringContract->id,
            ]);
        }

        return response()->json(['data' => new ContentPlanningItemResource($item->load('creator'))], 201);
    }

    public function updateItem(Request $request, ContentPlanningItem $contentPlanningItem): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'briefing' => ['nullable', 'string'],
            'script' => ['nullable', 'string'],
            'caption' => ['nullable', 'string'],
            'content_type' => ['sometimes', Rule::enum(ContentType::class)],
            'creator_id' => ['sometimes', 'exists:creators,id'],
            'month' => ['sometimes', 'string', 'max:7'],
            'planned_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(ContentPlanningStatus::class)],
            'submission_url' => ['nullable', 'string', 'max:2048'],
            'media_url' => ['nullable', 'string', 'max:2048'],
            'published_url' => ['nullable', 'string', 'max:2048'],
            'submission_notes' => ['nullable', 'string'],
            'feedback_note' => ['nullable', 'string'],
        ]);

        if (isset($data['submission_url']) || isset($data['media_url'])) {
            $data['submitted_at'] = now();
            $data['status'] ??= ContentPlanningStatus::Review;
        }
        if (isset($data['status']) && in_array($data['status'], [ContentPlanningStatus::Approved, ContentPlanningStatus::Rejected, ContentPlanningStatus::Published], true)) {
            $data['reviewed_at'] = now();
        }

        $contentPlanningItem->fill($data)->save();

        return response()->json(['data' => new ContentPlanningItemResource($contentPlanningItem->fresh()->load(['creator', 'company']))]);
    }

    public function destroyItem(ContentPlanningItem $contentPlanningItem): JsonResponse
    {
        $contentPlanningItem->delete();

        return response()->json(['message' => __('auth.item_removed')]);
    }

    private function assertCanView(Request $request, RecurringContract $contract): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        if ($user->role === UserRole::Company && $user->companyUser?->company_id === $contract->company_id) {
            return;
        }
        if ($user->role === UserRole::Creator && $contract->recurringContractCreators()->where('creator_id', $user->creator?->id)->exists()) {
            return;
        }
        abort(403, __('auth.forbidden'));
    }
}
