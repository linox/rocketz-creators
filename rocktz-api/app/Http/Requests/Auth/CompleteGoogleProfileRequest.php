<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CompleteGoogleProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
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
            'state' => ['required_if:type,creator', 'nullable', 'string', 'size:2'],
            'instagram' => ['required_if:type,creator', 'nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:120'],
            'name' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'responsible_name' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'segment' => ['nullable', 'string', 'max:120'],
            'objective' => ['nullable', 'string', 'max:2000'],
            'cnpj' => ['nullable', 'string', 'max:20'],
            'lgpd_accepted' => ['accepted'],
        ];
    }
}
