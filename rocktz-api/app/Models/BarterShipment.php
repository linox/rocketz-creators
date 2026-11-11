<?php

namespace App\Models;

use App\Enums\BarterShipmentMethod;
use App\Enums\BarterShipmentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BarterShipment extends Model
{
    protected $fillable = [
        'campaign_creator_id',
        'creator_id',
        'company_id',
        'description',
        'method',
        'tracking_code',
        'carrier_label',
        'status',
        'status_label',
        'service_label',
        'events',
        'days_in_transit',
        'posted_at',
        'delivered_at',
        'notified_delivered_at',
        'last_checked_at',
        'last_error',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'method' => BarterShipmentMethod::class,
            'status' => BarterShipmentStatus::class,
            'events' => 'array',
            'days_in_transit' => 'integer',
            'posted_at' => 'datetime',
            'delivered_at' => 'datetime',
            'notified_delivered_at' => 'datetime',
            'last_checked_at' => 'datetime',
        ];
    }

    public function campaignCreator(): BelongsTo
    {
        return $this->belongsTo(CampaignCreator::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
