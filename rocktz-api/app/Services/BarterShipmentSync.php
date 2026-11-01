<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\BarterShipmentMethod;
use App\Enums\BarterShipmentStatus;
use App\Enums\MailTemplateKey;
use App\Enums\UserRole;
use App\Models\BarterShipment;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\MailMessage;
use App\Models\User;
use App\Services\Mail\MailNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class BarterShipmentSync
{
    public function __construct(private readonly MailNotifier $mail) {}

    public function syncVisible(User $user): void
    {
        $query = CampaignCreator::query()
            ->where('application_status', ApplicationStatus::Approved)
            ->whereHas('campaign', fn ($campaign) => $campaign->where('is_barter', true))
            ->whereDoesntHave('barterShipment');

        if ($user->role === UserRole::Company) {
            $query->whereHas('campaign', fn ($campaign) => $campaign->where('company_id', $user->actingCompanyId() ?? 0));
        } elseif ($user->role === UserRole::Creator) {
            $query->where('creator_id', $user->creator?->id ?? 0);
        } elseif ($user->role !== UserRole::Admin) {
            return;
        }

        $this->insertPending($query->pluck('id'));
    }

    public function syncCampaign(Campaign $campaign): void
    {
        $participationIds = CampaignCreator::query()
            ->where('campaign_id', $campaign->id)
            ->pluck('id');

        if (! $campaign->is_barter) {
            $this->dropWaiting($participationIds);

            return;
        }

        $approvedIds = CampaignCreator::query()
            ->where('campaign_id', $campaign->id)
            ->where('application_status', ApplicationStatus::Approved)
            ->pluck('id');

        $this->dropWaiting($participationIds->diff($approvedIds));
        $missing = CampaignCreator::query()
            ->whereIn('id', $approvedIds)
            ->whereDoesntHave('barterShipment')
            ->pluck('id');
        $this->insertPending($missing);
    }

    public function syncParticipation(CampaignCreator $participation): void
    {
        $participation->loadMissing('campaign');
        $campaign = $participation->campaign;
        $receives = $campaign?->is_barter
            && $participation->application_status === ApplicationStatus::Approved;

        if ($receives) {
            BarterShipment::query()->firstOrCreate(
                ['campaign_creator_id' => $participation->id],
                [
                    'method' => BarterShipmentMethod::Correios,
                    'status' => BarterShipmentStatus::Pending,
                ],
            );

            return;
        }

        $this->dropWaiting(collect([$participation->id]));
    }

    /**
     * @param  Collection<int, int|string>  $participationIds
     */
    private function insertPending(Collection $participationIds): void
    {
        $now = now();
        $rows = $participationIds
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->map(fn (int $id) => [
                'campaign_creator_id' => $id,
                'method' => BarterShipmentMethod::Correios->value,
                'status' => BarterShipmentStatus::Pending->value,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->all();

        if ($rows === []) {
            return;
        }

        BarterShipment::query()->insertOrIgnore($rows);
    }

    public function refreshTracking(BarterShipment $shipment, CorreiosTracking $tracking): BarterShipment
    {
        if ($shipment->method !== BarterShipmentMethod::Correios || ! filled($shipment->tracking_code)) {
            return $shipment;
        }

        try {
            $snapshot = $tracking->lookup((string) $shipment->tracking_code);
        } catch (CorreiosTrackingException) {
            return $this->keepSnapshot($shipment);
        }

        return $this->applySnapshot($shipment, $snapshot);
    }

    /**
     * @param  array{
     *     status: BarterShipmentStatus,
     *     status_label: ?string,
     *     service_label: ?string,
     *     events: list<array<string, mixed>>,
     *     days_in_transit: ?int,
     *     posted_at: ?Carbon,
     *     delivered_at: ?Carbon,
     *     last_error: null
     * }  $snapshot
     */
    public function applySnapshot(BarterShipment $shipment, array $snapshot): BarterShipment
    {
        $storedEvents = is_array($shipment->events) ? $shipment->events : [];
        $incomingEvents = $snapshot['events'];
        $incomingStatus = $snapshot['status'];
        $incomplete = $incomingEvents === []
            && in_array($incomingStatus, [BarterShipmentStatus::NotFound, BarterShipmentStatus::Other], true);

        if ($storedEvents !== [] && $incomplete) {
            return $this->keepSnapshot($shipment);
        }

        $fill = [
            'last_checked_at' => now(),
            'last_error' => null,
        ];

        if ($incomingEvents !== []) {
            $fill['events'] = $incomingEvents;
        }

        $keepStatus = $storedEvents !== [] && $incomingStatus === BarterShipmentStatus::NotFound;
        if (! $keepStatus) {
            $fill['status'] = $incomingStatus;
        }

        if (filled($snapshot['status_label'])) {
            $fill['status_label'] = $snapshot['status_label'];
        }
        if (filled($snapshot['service_label'])) {
            $fill['service_label'] = $snapshot['service_label'];
        }
        if ($snapshot['days_in_transit'] !== null) {
            $fill['days_in_transit'] = $snapshot['days_in_transit'];
        }
        if ($snapshot['posted_at']) {
            $fill['posted_at'] = $snapshot['posted_at'];
        }
        if ($snapshot['delivered_at']) {
            $fill['delivered_at'] = $snapshot['delivered_at'];
        }

        $shipment->forceFill($fill)->save();
        $this->notifyDelivered($shipment);

        return $shipment;
    }

    private function keepSnapshot(BarterShipment $shipment): BarterShipment
    {
        $shipment->forceFill([
            'last_error' => 'unavailable',
            'last_checked_at' => now(),
        ])->save();

        return $shipment;
    }

    public function notifyDelivered(BarterShipment $shipment): void
    {
        if ($shipment->status !== BarterShipmentStatus::Delivered || $shipment->notified_delivered_at) {
            return;
        }

        $shipment->loadMissing('campaignCreator.creator.user', 'campaignCreator.campaign.company');
        $user = $shipment->campaignCreator?->creator?->user;
        $message = $user ? $this->mail->barterDelivered($shipment) : null;
        $recorded = $message || MailMessage::query()
            ->where('template_key', MailTemplateKey::BarterDelivered)
            ->where('related_type', $shipment::class)
            ->where('related_id', $shipment->id)
            ->exists();

        if ($recorded || ! $user) {
            $shipment->forceFill(['notified_delivered_at' => now()])->save();
        }
    }

    /**
     * @param  Collection<int, int|string>  $participationIds
     */
    private function dropWaiting(Collection $participationIds): void
    {
        $ids = $participationIds
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return;
        }

        BarterShipment::query()
            ->whereIn('campaign_creator_id', $ids)
            ->whereNull('tracking_code')
            ->where('status', BarterShipmentStatus::Pending)
            ->delete();
    }
}
