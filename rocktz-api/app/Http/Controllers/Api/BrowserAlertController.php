<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BrowserAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrowserAlertController extends Controller
{
    public function index(Request $request, BrowserAlertService $alerts): JsonResponse
    {
        return response()->json([
            'data' => $alerts->claimDue($request->user()),
        ]);
    }

    public function seen(Request $request, BrowserAlertService $alerts): JsonResponse
    {
        $data = $request->validate([
            'key' => ['required_without:inbox_id', 'nullable', 'string', 'max:160'],
            'inbox_id' => ['required_without:key', 'nullable', 'string', 'max:160'],
        ]);

        $alerts->markSeen($request->user(), $data['key'] ?? null, $data['inbox_id'] ?? null);

        return response()->json(['ok' => true]);
    }
}
