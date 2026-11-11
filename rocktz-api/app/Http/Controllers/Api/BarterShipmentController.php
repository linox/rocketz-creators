<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\BarterShipmentMethod;
use App\Enums\BarterShipmentStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\BarterShipment;
use App\Models\CampaignCreator;
use App\Models\Creator;
use App\Models\User;
use App\Services\BarterShipmentSync;
use App\Services\CorreiosTracking;
use App\Services\CorreiosTrackingException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BarterShipmentController extends Controller
{
    public function index(Request $request, BarterShipmentSync $shipments): JsonResponse
    {
        $user = $request->user();
        $shipments->syncVisible($user);
        $query = CampaignCreator::query()
            ->where('application_status', ApplicationStatus::Approved)
            ->whereHas('campaign', fn ($campaign) => $campaign->where('is_barter', true))
            ->with([
                'barterShipment',
                'creator:id,artistic_name,full_name,photo_url,city,state',
                'campaign:id,name,company_id,is_barter,barter_details',
                'campaign.company:id,name',
            ]);

        if ($user->role === UserRole::Company) {
            $query->whereHas('campaign', fn ($campaign) => $campaign->where('company_id', $user->actingCompanyId() ?? 0));
        } elseif ($user->role === UserRole::Creator) {
            $query->where('creator_id', $user->creator?->id ?? 0);
        } elseif ($user->role !== UserRole::Admin) {
            abort(403, __('auth.forbidden'));
        }

        $rows = $query->get()
            ->sortBy(fn (CampaignCreator $row) => mb_strtolower(($row->campaign?->name ?? '').' '.($row->creator?->artistic_name ?? '')))
            ->values()
            ->map(fn (CampaignCreator $row) => $this->present($row, $this->canManage($user, $row)));

        $standalone = $this->standaloneQuery($user)
            ->get()
            ->sortBy(fn (BarterShipment $shipment) => mb_strtolower(($shipment->creator?->artistic_name ?? '').' '.($shipment->description ?? '')))
            ->values()
            ->map(fn (BarterShipment $shipment) => $this->presentStandalone($shipment, $this->canManageStandalone($user, $shipment)));

        return response()->json([
            'data' => $rows->concat($standalone)->values(),
        ]);
    }

    public function store(Request $request, CorreiosTracking $tracking, BarterShipmentSync $shipments): JsonResponse
    {
        $user = $request->user();
        $data = $this->validateShipment($request, true);
        $creator = $this->recipient($user, (int) $data['creator_id']);
        $companyId = $this->actingCompanyId($user);

        $shipment = new BarterShipment([
            'creator_id' => $creator->id,
            'company_id' => $companyId,
            'description' => $this->blank($data['description'] ?? null),
        ]);
        $this->writeShipment($shipment, $data, $tracking, $shipments);

        return response()->json([
            'data' => $this->presentStandalone($this->reloadStandalone($shipment), true),
        ], 201);
    }

    public function update(Request $request, CampaignCreator $campaignCreator, CorreiosTracking $tracking, BarterShipmentSync $shipments): JsonResponse
    {
        $this->assertCanManage($request->user(), $campaignCreator);
        $data = $this->validateShipment($request, false);
        $existing = $campaignCreator->barterShipment ?? new BarterShipment([
            'campaign_creator_id' => $campaignCreator->id,
        ]);
        $this->writeShipment($existing, $data, $tracking, $shipments);

        return response()->json(['data' => $this->present($this->reload($campaignCreator), true)]);
    }

    public function updateStandalone(Request $request, BarterShipment $barterShipment, CorreiosTracking $tracking, BarterShipmentSync $shipments): JsonResponse
    {
        $this->assertStandalone($request->user(), $barterShipment);
        $data = $this->validateShipment($request, true);
        $creator = $this->recipient($request->user(), (int) $data['creator_id']);
        $barterShipment->creator_id = $creator->id;
        $barterShipment->description = $this->blank($data['description'] ?? null);
        $this->writeShipment($barterShipment, $data, $tracking, $shipments);

        return response()->json([
            'data' => $this->presentStandalone($this->reloadStandalone($barterShipment), true),
        ]);
    }

    public function refresh(Request $request, CampaignCreator $campaignCreator, CorreiosTracking $tracking, BarterShipmentSync $shipments): JsonResponse
    {
        $this->assertCanManage($request->user(), $campaignCreator);
        $shipment = $campaignCreator->barterShipment;
        abort_unless(
            $shipment && $shipment->method === BarterShipmentMethod::Correios && filled($shipment->tracking_code),
            422,
            __('barter.code_required'),
        );

        $this->sync($shipment, $tracking, $shipments);

        return response()->json(['data' => $this->present($this->reload($campaignCreator), true)]);
    }

    public function refreshStandalone(Request $request, BarterShipment $barterShipment, CorreiosTracking $tracking, BarterShipmentSync $shipments): JsonResponse
    {
        $this->assertStandalone($request->user(), $barterShipment);
        abort_unless(
            $barterShipment->method === BarterShipmentMethod::Correios && filled($barterShipment->tracking_code),
            422,
            __('barter.code_required'),
        );

        $this->sync($barterShipment, $tracking, $shipments);

        return response()->json([
            'data' => $this->presentStandalone($this->reloadStandalone($barterShipment), true),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateShipment(Request $request, bool $standalone): array
    {
        $rules = [
            'method' => ['required', Rule::enum(BarterShipmentMethod::class)],
            'tracking_code' => ['nullable', 'string', 'max:20'],
            'carrier_label' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];

        if ($standalone) {
            $rules['creator_id'] = ['required', 'integer', 'exists:creators,id'];
            $rules['description'] = ['required', 'string', 'max:180'];
        }

        $data = $request->validate($rules);

        if ($standalone && $this->blank($data['description'] ?? null) === null) {
            throw ValidationException::withMessages(['description' => __('barter.description_required')]);
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function writeShipment(BarterShipment $shipment, array $data, CorreiosTracking $tracking, BarterShipmentSync $shipments): BarterShipment
    {
        $method = BarterShipmentMethod::from($data['method']);
        $notes = $this->blank($data['notes'] ?? null);
        $wasHand = $shipment->exists && $shipment->method === BarterShipmentMethod::Hand;

        if ($method === BarterShipmentMethod::Correios) {
            $code = $this->normalizeCode($data['tracking_code'] ?? null);
            if ($code === '') {
                throw ValidationException::withMessages(['tracking_code' => __('barter.code_required')]);
            }
            if (! preg_match('/^[A-Z]{2}\d{9}[A-Z]{2}$/', $code)) {
                throw ValidationException::withMessages(['tracking_code' => __('barter.invalid_code')]);
            }

            $sameCode = $shipment->exists
                && $shipment->method === BarterShipmentMethod::Correios
                && $shipment->tracking_code === $code;
            $shipment->fill([
                'method' => $method,
                'notes' => $notes,
                'tracking_code' => $code,
                'carrier_label' => null,
            ]);

            if (! $sameCode) {
                $shipment->forceFill([
                    'status' => BarterShipmentStatus::Pending,
                    'status_label' => null,
                    'service_label' => null,
                    'events' => null,
                    'days_in_transit' => null,
                    'posted_at' => null,
                    'delivered_at' => null,
                    'notified_delivered_at' => null,
                    'last_error' => null,
                ]);
            }

            $shipment->save();

            try {
                $shipments->applySnapshot($shipment, $tracking->lookup($code));
            } catch (CorreiosTrackingException) {
                $shipment->forceFill([
                    'last_error' => 'unavailable',
                    'last_checked_at' => now(),
                ])->save();
            }

            return $shipment;
        }

        $shipment->fill([
            'method' => $method,
            'notes' => $notes,
            'tracking_code' => null,
            'carrier_label' => null,
            'status_label' => null,
            'service_label' => null,
            'events' => null,
            'days_in_transit' => null,
            'posted_at' => null,
            'last_checked_at' => null,
            'last_error' => null,
        ]);

        if ($method === BarterShipmentMethod::Hand) {
            $shipment->status = BarterShipmentStatus::Handed;
            $shipment->delivered_at = $wasHand ? ($shipment->delivered_at ?? now()) : now();
        } else {
            $shipment->status = BarterShipmentStatus::Sent;
            $shipment->carrier_label = $this->blank($data['carrier_label'] ?? null);
            $shipment->delivered_at = null;
        }

        $shipment->save();

        return $shipment;
    }

    private function sync(BarterShipment $shipment, CorreiosTracking $tracking, BarterShipmentSync $shipments): BarterShipment
    {
        return $shipments->refreshTracking($shipment, $tracking);
    }

    private function reload(CampaignCreator $campaignCreator): CampaignCreator
    {
        $campaignCreator->unsetRelation('barterShipment');
        $campaignCreator->load(['barterShipment', 'creator', 'campaign.company']);

        return $campaignCreator;
    }

    private function reloadStandalone(BarterShipment $shipment): BarterShipment
    {
        $shipment->unsetRelations();

        return $shipment->load(['creator', 'company']);
    }

    private function assertCanManage(User $user, CampaignCreator $campaignCreator): void
    {
        $campaignCreator->loadMissing('campaign');
        $campaign = $campaignCreator->campaign;
        abort_unless($campaign && $campaign->is_barter, 422, __('barter.not_barter'));
        abort_unless($campaignCreator->application_status === ApplicationStatus::Approved, 422, __('barter.not_approved'));
        abort_unless($this->canManage($user, $campaignCreator), 403, __('auth.forbidden'));
    }

    private function assertStandalone(User $user, BarterShipment $shipment): void
    {
        abort_unless($shipment->campaign_creator_id === null, 404);
        abort_unless($this->canManageStandalone($user, $shipment), 403, __('auth.forbidden'));
    }

    private function canManage(User $user, CampaignCreator $campaignCreator): bool
    {
        if ($user->role === UserRole::Admin) {
            return true;
        }

        return $user->role === UserRole::Company
            && $user->belongsToCompany((int) $campaignCreator->campaign?->company_id);
    }

    private function canManageStandalone(User $user, BarterShipment $shipment): bool
    {
        if ($user->role === UserRole::Admin) {
            return true;
        }

        return $user->role === UserRole::Company
            && $shipment->company_id
            && $user->belongsToCompany((int) $shipment->company_id);
    }

    private function actingCompanyId(User $user): ?int
    {
        if ($user->role !== UserRole::Company) {
            return null;
        }

        $companyId = (int) $user->actingCompanyId();
        abort_unless($companyId, 403, __('auth.company_not_linked'));

        return $companyId;
    }

    private function recipient(User $user, int $creatorId): Creator
    {
        $creator = Creator::query()->findOrFail($creatorId);
        if ($user->role === UserRole::Company) {
            $companyId = (int) $user->actingCompanyId();
            abort_unless($companyId && $creator->isAccessibleByCompany($companyId), 422, __('barter.creator_unavailable'));
        }

        return $creator;
    }

    /**
     * @return Builder<BarterShipment>
     */
    private function standaloneQuery(User $user): Builder
    {
        $query = BarterShipment::query()
            ->whereNull('campaign_creator_id')
            ->with([
                'creator:id,artistic_name,full_name,photo_url,city,state',
                'company:id,name',
            ]);

        if ($user->role === UserRole::Company) {
            $query->where('company_id', $user->actingCompanyId() ?? 0);
        } elseif ($user->role === UserRole::Creator) {
            $query->where('creator_id', $user->creator?->id ?? 0);
        } elseif ($user->role !== UserRole::Admin) {
            $query->whereRaw('0 = 1');
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    private function present(CampaignCreator $row, bool $canManage): array
    {
        $row->loadMissing(['barterShipment', 'creator', 'campaign.company']);

        return [
            'id' => $row->barterShipment?->id,
            'standalone' => false,
            'campaign_creator_id' => $row->id,
            'can_manage' => $canManage,
            'campaign' => [
                'id' => $row->campaign?->id,
                'name' => $row->campaign?->name,
                'company_name' => $row->campaign?->company?->name,
                'barter_details' => $row->campaign?->barter_details,
            ],
            'creator' => $this->presentCreator($row->creator),
            'shipment' => $this->presentShipment($row->barterShipment),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentStandalone(BarterShipment $shipment, bool $canManage): array
    {
        $shipment->loadMissing(['creator', 'company']);

        return [
            'id' => $shipment->id,
            'standalone' => true,
            'campaign_creator_id' => null,
            'can_manage' => $canManage,
            'campaign' => [
                'id' => null,
                'name' => null,
                'company_name' => $shipment->company?->name,
                'barter_details' => $shipment->description,
            ],
            'creator' => $this->presentCreator($shipment->creator),
            'shipment' => $this->presentShipment($shipment),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentCreator(?Creator $creator): array
    {
        return [
            'id' => $creator?->id,
            'artistic_name' => $creator?->artistic_name,
            'full_name' => $creator?->full_name,
            'photo_url' => $creator?->photo_url,
            'city' => $creator?->city,
            'state' => $creator?->state,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function presentShipment(?BarterShipment $shipment): ?array
    {
        if (! $shipment) {
            return null;
        }

        return [
            'method' => $shipment->method?->value,
            'tracking_code' => $shipment->tracking_code,
            'carrier_label' => $shipment->carrier_label,
            'status' => $shipment->status?->value,
            'status_label' => $shipment->status_label,
            'service_label' => $shipment->service_label,
            'events' => $shipment->events ?? [],
            'days_in_transit' => $shipment->days_in_transit,
            'posted_at' => $shipment->posted_at?->toIso8601String(),
            'delivered_at' => $shipment->delivered_at?->toIso8601String(),
            'last_checked_at' => $shipment->last_checked_at?->toIso8601String(),
            'last_error' => $shipment->last_error,
            'notes' => $shipment->notes,
        ];
    }

    private function normalizeCode(mixed $value): string
    {
        return strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $value));
    }

    private function blank(mixed $value): ?string
    {
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }
}
