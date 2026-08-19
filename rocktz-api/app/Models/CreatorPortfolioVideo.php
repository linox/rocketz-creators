<?php

namespace App\Models;

use Database\Factories\CreatorPortfolioVideoFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['creator_id', 'title', 'url', 'description', 'uploaded_at'])]
class CreatorPortfolioVideo extends Model
{
    /** @use HasFactory<CreatorPortfolioVideoFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'uploaded_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }
}
