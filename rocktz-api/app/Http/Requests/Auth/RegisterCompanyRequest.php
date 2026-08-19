<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class RegisterCompanyRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'responsible_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
            'whatsapp' => ['required', 'string', 'max:30'],
            'city' => ['nullable', 'string', 'max:120'],
            'state' => ['nullable', 'string', 'size:2'],
            'cnpj' => ['nullable', 'string', 'max:20'],
            'segment' => ['nullable', 'string', 'max:120'],
            'objective' => ['nullable', 'string', 'max:2000'],
            'lgpd_accepted' => ['accepted'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'lgpd_accepted.accepted' => 'Você precisa autorizar o uso de dados de acordo com a LGPD.',
        ];
    }
}
