<?php

namespace App\Console\Commands;

use App\Enums\BarterShipmentMethod;
use App\Enums\BarterShipmentStatus;
use App\Models\BarterShipment;
use App\Services\BarterShipmentSync;
use App\Services\CorreiosTracking;
use Illuminate\Console\Command;

class SyncBarterTrackingCommand extends Command
{
    protected $signature = 'barter:sync-tracking';

    protected $description = 'Refresh open Correios barter shipments and email creators when a package is delivered';

    public function handle(CorreiosTracking $tracking, BarterShipmentSync $shipments): int
    {
        $open = BarterShipment::query()
            ->where('method', BarterShipmentMethod::Correios)
            ->whereNotNull('tracking_code')
            ->whereNotIn('status', [
                BarterShipmentStatus::Delivered->value,
                BarterShipmentStatus::Handed->value,
                BarterShipmentStatus::Returned->value,
            ])
            ->orderBy('last_checked_at')
            ->limit(20)
            ->get();

        foreach ($open as $shipment) {
            $shipments->refreshTracking($shipment, $tracking);
            usleep(150000);
        }

        BarterShipment::query()
            ->where('status', BarterShipmentStatus::Delivered->value)
            ->whereNull('notified_delivered_at')
            ->limit(20)
            ->get()
            ->each(fn (BarterShipment $shipment) => $shipments->notifyDelivered($shipment));

        $this->info('Rastreados: '.$open->count());

        return self::SUCCESS;
    }
}
