<?php

namespace App\Models;

use Database\Factories\CampaignBriefingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'campaign_id',
    'product',
    'key_message',
    'must_have',
    'donts',
    'cta',
    'hashtags',
    'link',
    'coupon',
    'attachments',
])]
class CampaignBriefing extends Model
{
    /** @use HasFactory<CampaignBriefingFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attachments' => 'array',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
