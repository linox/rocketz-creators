<?php

namespace App\Models;

use Database\Factories\CreatorGroupFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable([
    'company_id',
    'name',
    'description',
])]
class CreatorGroup extends Model
{
    /** @use HasFactory<CreatorGroupFactory> */
    use HasFactory;

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function creators(): BelongsToMany
    {
        return $this->belongsToMany(Creator::class, 'creator_group_members')->withTimestamps();
    }

    public function campaigns(): BelongsToMany
    {
        return $this->belongsToMany(Campaign::class, 'campaign_creator_group')->withTimestamps();
    }
}
