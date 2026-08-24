<?php

namespace App\Models;

use App\Enums\MailTemplateAudience;
use App\Enums\MailTemplateCategory;
use App\Enums\MailTemplateKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MailTemplate extends Model
{
    protected $fillable = [
        'key',
        'audience',
        'category',
        'enabled',
        'reminder_offsets',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'key' => MailTemplateKey::class,
            'audience' => MailTemplateAudience::class,
            'category' => MailTemplateCategory::class,
            'enabled' => 'boolean',
            'reminder_offsets' => 'array',
        ];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(MailTemplateVersion::class);
    }

    public function latestVersionFor(string $locale): ?MailTemplateVersion
    {
        return $this->versions()
            ->where('locale', $locale)
            ->latest('id')
            ->first();
    }
}
