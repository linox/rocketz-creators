<?php

namespace App\Http\Requests\Auth;

use App\Models\Company;
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
            'invite_code' => $this->filled('invite_code')
                ? Company::normalizeInviteCode((string) $this->input('invite_code'))
                : null,
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
            'invite_code' => ['nullable', 'string', 'max:16', function (string $attribute, mixed $value, \Closure $fail) {
                if (! filled($value)) {
                    return;
                }
                if (! Company::findActiveByInviteCode((string) $value)) {
                    $fail(__('auth.invite_code_invalid'));
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
