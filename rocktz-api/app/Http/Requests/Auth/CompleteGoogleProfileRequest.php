<?php

namespace App\Http\Requests\Auth;

use App\Models\Company;
use App\Models\CompanyLandingPage;
use App\Services\CompanyLandingService;
use App\Support\Geo;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CompleteGoogleProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $country = Geo::normalizeCountry($this->input('country') ?: Geo::DEFAULT_COUNTRY);
        $this->merge([
            'country' => $country,
            'currency' => Geo::normalizeCurrency($this->input('currency') ?: Geo::defaultCurrency($country)),
            'invite_code' => $this->filled('invite_code')
                ? Company::normalizeInviteCode((string) $this->input('invite_code'))
                : null,
            'landing_slug' => $this->filled('landing_slug')
                ? CompanyLandingPage::normalizeSlug((string) $this->input('landing_slug'))
                : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['creator', 'company'])],
            'full_name' => ['required_if:type,creator', 'nullable', 'string', 'max:255'],
            'artistic_name' => ['required_if:type,creator', 'nullable', 'string', 'max:255'],
            'whatsapp' => ['required', 'string', 'max:30'],
            'city' => ['required_if:type,creator', 'nullable', 'string', 'max:120'],
            'country' => Geo::countryRules(),
            'state' => Geo::regionRules(Geo::normalizeCountry((string) $this->input('country', Geo::DEFAULT_COUNTRY)), $this->input('type') === 'creator'),
            'currency' => Geo::currencyRules($this->input('type') === 'company'),
            'instagram' => ['required_if:type,creator', 'nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:120'],
            'name' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'responsible_name' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'segment' => ['nullable', 'string', 'max:120'],
            'objective' => ['nullable', 'string', 'max:2000'],
            'cnpj' => ['nullable', 'string', 'max:20'],
            'invite_code' => ['nullable', 'string', 'max:16', function (string $attribute, mixed $value, \Closure $fail) {
                if (! filled($value) || $this->input('type') !== 'creator') {
                    return;
                }
                if (! Company::findActiveByInviteCode((string) $value)) {
                    $fail(__('auth.invite_code_invalid'));
                }
            }],
            'landing_slug' => ['nullable', 'string', 'max:64', function (string $attribute, mixed $value, \Closure $fail) {
                if (! filled($value) || $this->input('type') !== 'creator') {
                    return;
                }
                try {
                    app(CompanyLandingService::class)->publishedBySlug((string) $value);
                } catch (\Throwable) {
                    $fail(__('auth.landing_unavailable'));
                }
            }],
            'lgpd_accepted' => ['accepted'],
            'locale' => ['nullable', 'string', 'in:pt-BR,en,es'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'lgpd_accepted.accepted' => __('auth.lgpd_required'),
        ];
    }
}
