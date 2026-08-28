<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category' => ['nullable', Rule::in(['access', 'action'])],
            'action' => ['nullable', 'string', 'max:80'],
            'role' => ['nullable', Rule::in(['admin', 'creator', 'company'])],
            'q' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $query = ActivityLog::query()->with('user:id,name,email,role')->latest();

        if (! empty($data['category'])) {
            $query->where('category', $data['category']);
        }
        if (! empty($data['action'])) {
            $query->where('action', $data['action']);
        }
        if (! empty($data['role'])) {
            $query->where('actor_role', $data['role']);
        }
        if (! empty($data['q'])) {
            $needle = '%'.$data['q'].'%';
            $query->where(function ($inner) use ($needle) {
                $inner->where('actor_email', 'like', $needle)
                    ->orWhere('actor_name', 'like', $needle)
                    ->orWhere('ip', 'like', $needle)
                    ->orWhere('path', 'like', $needle);
            });
        }
        if (! empty($data['from'])) {
            $query->where('created_at', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $query->where('created_at', '<=', $data['to'].' 23:59:59');
        }

        $today = now()->startOfDay();

        return response()->json([
            'data' => $query->limit(200)->get(),
            'meta' => [
                'today_logins' => ActivityLog::query()->where('action', 'login.success')->where('created_at', '>=', $today)->count(),
                'today_failed' => ActivityLog::query()->where('action', 'login.failed')->where('created_at', '>=', $today)->count(),
                'today_actions' => ActivityLog::query()->where('category', 'action')->where('created_at', '>=', $today)->count(),
            ],
        ]);
    }
}
