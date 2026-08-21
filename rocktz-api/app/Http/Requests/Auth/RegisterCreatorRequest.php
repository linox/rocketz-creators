<?php

namespace App\Http\Requests\Auth;

use App\Support\Geo;
use Illuminate\Foundation\Http\FormRequest;

class RegisterCreatorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'country' => Geo::normalizeCountry($this->input('country') ?: Geo::DEFAULT_COUNTRY),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $country = Geo::normalizeCountry((string) $this->input('country', Geo::DEFAULT_COUNTRY));

        return [
            'full_name' => ['required', 'string', 'max:255'],
            'artistic_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
            'whatsapp' => ['required', 'string', 'max:30'],
            'city' => ['required', 'string', 'max:120'],
            'country' => Geo::countryRules(),
            'state' => Geo::regionRules($country),
            'instagram' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:120'],
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
