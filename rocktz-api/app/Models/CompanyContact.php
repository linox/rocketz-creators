<?php

namespace App\Models;

use App\Support\SensitiveIndex;
use Database\Factories\CompanyContactFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['company_id', 'name', 'role', 'email', 'whatsapp'])]
class CompanyContact extends Model
{
    /** @use HasFactory<CompanyContactFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email' => 'encrypted',
            'whatsapp' => 'encrypted',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (CompanyContact $contact) {
            if ($contact->isDirty('email')) {
                $contact->email_hash = SensitiveIndex::normalized($contact->email);
            }
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
