<?php

namespace App\Http\Requests\Auth;

use App\Support\Geo;
use Illuminate\Foundation\Http\FormRequest;

class RegisterCompanyRequest extends FormRequest
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
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'responsible_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'whatsapp' => ['required', 'string', 'max:30'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => Geo::countryRules(),
            'currency' => Geo::currencyRules(),
            'cnpj' => ['nullable', 'string', 'max:20'],
            'segment' => ['nullable', 'string', 'max:120'],
            'objective' => ['nullable', 'string', 'max:2000'],
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
