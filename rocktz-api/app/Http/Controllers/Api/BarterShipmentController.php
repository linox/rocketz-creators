<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\BarterShipmentMethod;
use App\Enums\BarterShipmentStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\BarterShipment;
use App\Models\CampaignCreator;
use App\Models\User;
use App\Services\BarterShipmentSync;
use App\Services\CorreiosTracking;
use App\Services\CorreiosTrackingException;
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
            ->values();

        return response()->json([
            'data' => $rows->map(fn (CampaignCreator $row) => $this->present($row, $this->canManage($user, $row)))->values(),
        ]);
    }

    public function update(Request $request, CampaignCreator $campaignCreator, CorreiosTracking $tracking, BarterShipmentSync $shipments): JsonResponse
    {
        $this->assertCanManage($request->user(), $campaignCreator);

        $data = $request->validate([
            'method' => ['required', Rule::enum(BarterShipmentMethod::class)],
            'tracking_code' => ['nullable', 'string', 'max:20'],
            'carrier_label' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $method = BarterShipmentMethod::from($data['method']);
        $notes = $this->blank($data['notes'] ?? null);
        $existing = $campaignCreator->barterShipment;

        if ($method === BarterShipmentMethod::Correios) {
            $code = $this->normalizeCode($data['tracking_code'] ?? null);
            if ($code === '') {
                throw ValidationException::withMessages(['tracking_code' => __('barter.code_required')]);
            }
            if (! preg_match('/^[A-Z]{2}\d{9}[A-Z]{2}$/', $code)) {
                throw ValidationException::withMessages(['tracking_code' => __('barter.invalid_code')]);
            }

            $attributes = [
                'method' => $method,
                'notes' => $notes,
                'tracking_code' => $code,
                'carrier_label' => null,
            ];
            $sameCode = $existing?->tracking_code === $code;

            try {
                $attributes = [
                    ...$attributes,
                    ...$tracking->lookup($code),
                    'last_checked_at' => now(),
                ];
            } catch (CorreiosTrackingException) {
                $attributes['last_error'] = 'unavailable';
                $attributes['last_checked_at'] = now();
                if (! $sameCode) {
                    $attributes['status'] = BarterShipmentStatus::Pending;
                    $attributes['status_label'] = null;
                    $attributes['service_label'] = null;
                    $attributes['events'] = null;
                    $attributes['days_in_transit'] = null;
                    $attributes['posted_at'] = null;
                    $attributes['delivered_at'] = null;
                }
            }

            $saved = $this->persist($campaignCreator, $attributes);
            $shipments->notifyDelivered($saved);

            return response()->json(['data' => $this->present($this->reload($campaignCreator), true)]);
        }

        $attributes = [
            'method' => $method,
            'notes' => $notes,
            'tracking_code' => null,
            'carrier_label' => null,
            'status_label' => null,
            'service_label' => null,
            'events' => null,
            'days_in_transit' => null,
            'posted_at' => null,
            'delivered_at' => null,
            'last_checked_at' => null,
            'last_error' => null,
        ];

        if ($method === BarterShipmentMethod::Hand) {
            $attributes['status'] = BarterShipmentStatus::Handed;
            $attributes['delivered_at'] = $existing?->method === BarterShipmentMethod::Hand
                ? ($existing->delivered_at ?? now())
                : now();
        } else {
            $attributes['status'] = BarterShipmentStatus::Sent;
            $attributes['carrier_label'] = $this->blank($data['carrier_label'] ?? null);
        }

        $this->persist($campaignCreator, $attributes);

        return response()->json(['data' => $this->present($this->reload($campaignCreator), true)]);
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

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function persist(CampaignCreator $campaignCreator, array $attributes): BarterShipment
    {
        return BarterShipment::query()->updateOrCreate(
            ['campaign_creator_id' => $campaignCreator->id],
            $attributes,
        );
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

    private function assertCanManage(User $user, CampaignCreator $campaignCreator): void
    {
        $campaignCreator->loadMissing('campaign');
        $campaign = $campaignCreator->campaign;
        abort_unless($campaign && $campaign->is_barter, 422, __('barter.not_barter'));
        abort_unless($campaignCreator->application_status === ApplicationStatus::Approved, 422, __('barter.not_approved'));
        abort_unless($this->canManage($user, $campaignCreator), 403, __('auth.forbidden'));
    }

    private function canManage(User $user, CampaignCreator $campaignCreator): bool
    {
        if ($user->role === UserRole::Admin) {
            return true;
        }

        return $user->role === UserRole::Company
            && $user->belongsToCompany((int) $campaignCreator->campaign?->company_id);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(CampaignCreator $row, bool $canManage): array
    {
        $row->loadMissing(['barterShipment', 'creator', 'campaign.company']);
        $shipment = $row->barterShipment;

        return [
            'campaign_creator_id' => $row->id,
            'can_manage' => $canManage,
            'campaign' => [
                'id' => $row->campaign?->id,
                'name' => $row->campaign?->name,
                'company_name' => $row->campaign?->company?->name,
                'barter_details' => $row->campaign?->barter_details,
            ],
            'creator' => [
                'id' => $row->creator?->id,
                'artistic_name' => $row->creator?->artistic_name,
                'full_name' => $row->creator?->full_name,
                'photo_url' => $row->creator?->photo_url,
                'city' => $row->creator?->city,
                'state' => $row->creator?->state,
            ],
            'shipment' => $shipment ? [
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
            ] : null,
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
