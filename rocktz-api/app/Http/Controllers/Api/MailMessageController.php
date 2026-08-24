<?php

namespace App\Http\Controllers\Api;

use App\Enums\MailMessageStatus;
use App\Enums\MailTemplateKey;
use App\Http\Controllers\Controller;
use App\Models\MailMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MailMessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::enum(MailMessageStatus::class)],
            'template_key' => ['nullable', Rule::enum(MailTemplateKey::class)],
            'campaign_id' => ['nullable', 'integer'],
            'company_id' => ['nullable', 'integer'],
            'email' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $query = MailMessage::query()->with('user')->latest();
        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }
        if (! empty($data['template_key'])) {
            $query->where('template_key', $data['template_key']);
        }
        if (! empty($data['campaign_id'])) {
            $query->where('campaign_id', $data['campaign_id']);
        }
        if (! empty($data['company_id'])) {
            $query->where('company_id', $data['company_id']);
        }
        if (! empty($data['email'])) {
            $query->where('email', 'like', '%'.$data['email'].'%');
        }
        if (! empty($data['from'])) {
            $query->where('created_at', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $query->where('created_at', '<=', $data['to'].' 23:59:59');
        }

        return response()->json(['data' => $query->limit(200)->get()]);
    }
}
