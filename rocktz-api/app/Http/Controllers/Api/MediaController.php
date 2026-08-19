<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ]);

        $file = $request->file('file');
        $filename = 'avatar-'.now()->format('YmdHis').'-'.Str::lower(Str::random(8)).'.'.$file->extension();
        $path = $file->storeAs('avatars', $filename, 'uploads');

        $media = MediaFile::query()->create([
            'filename' => $filename,
            'disk' => 'uploads',
            'path' => $path,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'uploaded_by' => $request->user()?->id,
            'mediable_type' => $request->user() ? $request->user()::class : null,
            'mediable_id' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => [
                'id' => $media->id,
                'url' => Storage::disk('uploads')->url($path),
                'filename' => $filename,
                'path' => $path,
            ],
        ], 201);
    }
}
