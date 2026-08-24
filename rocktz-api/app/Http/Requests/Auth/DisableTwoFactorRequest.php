<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class DisableTwoFactorRequest extends FormRequest
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
            'password' => ['nullable', 'string'],
            'challenge_token' => ['nullable', 'string', 'min:32', 'max:128'],
            'code' => ['nullable', 'string', 'regex:/^\d{6}$/'],
        ];
    }
}
