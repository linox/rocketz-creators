<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Geo;
use App\Support\PostalLookup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PostalCodeController extends Controller
{
    public function __invoke(Request $request, PostalLookup $lookup): JsonResponse
    {
        $data = $request->validate([
            'country' => ['required', 'string', 'size:2'],
            'code' => ['required', 'string', 'max:20'],
        ]);

        if (! Geo::isValidCountry($data['country'])) {
            throw ValidationException::withMessages([
                'country' => __('validation.in', ['attribute' => 'country']),
            ]);
        }

        $found = $lookup->find($data['country'], $data['code']);
        if ($found === null) {
            return response()->json([
                'message' => __('auth.postal_code_not_found'),
            ], 404);
        }

        return response()->json(['data' => $found]);
    }
}
