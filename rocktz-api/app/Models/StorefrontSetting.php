<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;

class StorefrontSetting extends Model
{
    protected $fillable = [
        'min_completed_campaigns',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'min_completed_campaigns' => 'integer',
        ];
    }

    public static function current(): self
    {
        $default = max(1, (int) config('storefront.min_completed_campaigns', 3));

        try {
            $row = static::query()->first();
            if ($row) {
                return $row;
            }

            return static::query()->create([
                'min_completed_campaigns' => $default,
            ]);
        } catch (QueryException) {
            $fallback = new self();
            $fallback->min_completed_campaigns = $default;

            return $fallback;
        }
    }
}
