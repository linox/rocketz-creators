<?php

namespace App\Http\Resources;

use App\Enums\FinancePaymentSource;
use App\Enums\FinancePaymentStatus;
use App\Enums\UserRole;
use App\Support\MediaUrl;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FinancePaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $media = $this->invoiceMedia;
        $invoiceUrl = null;
        $invoicePreviewUrl = null;
        if ($media) {
            $invoiceUrl = str_starts_with((string) $media->path, 'documents/')
                ? MediaUrl::download($media->path)
                : MediaUrl::playback($media->path);
            $invoicePreviewUrl = str_starts_with((string) $media->path, 'documents/')
                ? MediaUrl::preview($media->path)
                : MediaUrl::playback($media->path);
        }

        $overdue = $this->status instanceof FinancePaymentStatus
            && $this->status->owesInvoice()
            && $this->invoice_due_date
            && $this->invoice_due_date->toDateString() < now()->toDateString();
        $manager = in_array($request->user()?->role, [UserRole::Admin, UserRole::Company], true);

        return [
            'id' => $this->id,
            'company_id' => (int) $this->company_id,
            'creator_id' => (int) $this->creator_id,
            'source' => $this->source?->value,
            'campaign_id' => $this->campaign_id ? (int) $this->campaign_id : null,
            'campaign_creator_id' => $this->campaign_creator_id ? (int) $this->campaign_creator_id : null,
            'recurring_contract_id' => $this->recurring_contract_id ? (int) $this->recurring_contract_id : null,
            'reference_month' => $this->reference_month?->toDateString(),
            'amount' => $this->amount !== null ? (float) $this->amount : 0,
            'currency' => $this->currency ?: 'BRL',
            'invoice_due_date' => $this->invoice_due_date?->toDateString(),
            'payment_due_date' => $this->payment_due_date?->toDateString(),
            'status' => $this->status?->value,
            'invoice_overdue' => $overdue,
            'invoice_url' => $invoiceUrl,
            'invoice_preview_url' => $invoicePreviewUrl,
            'invoice_mime' => $media?->mime_type,
            'invoice_filename' => $media?->filename,
            'invoice_submitted_at' => $this->invoice_submitted_at?->toIso8601String(),
            'rejection_reason' => $this->rejection_reason,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toDateString(),
            'invoice_data' => $this->relationLoaded('company') ? $this->company?->invoiceDataFor($this->source) : null,
            'title' => $this->source === FinancePaymentSource::Coupon
                ? __('auth.coupon_earning_title')
                : ($this->campaign?->name ?: $this->recurringContract?->title),
            'company' => $this->whenLoaded('company', fn () => $this->company ? [
                'id' => $this->company->id,
                'name' => $this->company->name,
            ] : null),
            'creator' => $this->whenLoaded('creator', function () use ($manager) {
                if (! $this->creator) {
                    return null;
                }

                $creator = [
                    'id' => $this->creator->id,
                    'artistic_name' => $this->creator->artistic_name,
                    'full_name' => $this->creator->full_name,
                    'photo_url' => MediaUrl::publicAbsolute($this->creator->photo_url),
                ];

                if ($manager) {
                    $creator['pix_key'] = $this->readableSecret($this->creator, 'pix_key');
                    $creator['bank_account'] = $this->readableSecret($this->creator, 'bank_account');
                }

                return $creator;
            }),
        ];
    }

    private function readableSecret(mixed $model, string $key): mixed
    {
        try {
            return $model->{$key};
        } catch (DecryptException) {
            $raw = $model->getRawOriginal($key);
            if (! is_string($raw) || $raw === '' || str_starts_with($raw, 'eyJpdiI6')) {
                return null;
            }

            if ($key === 'bank_account') {
                $decoded = json_decode($raw, true);

                return is_array($decoded) ? $decoded : null;
            }

            return $raw;
        }
    }
}
