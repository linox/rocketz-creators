<?php

use App\Http\Controllers\Api\MediaController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/preview/documents/{filename}', [MediaController::class, 'previewDocument'])
    ->where('filename', '[A-Za-z0-9._-]+')
    ->middleware('signed:relative')
    ->name('media.documents.preview');

Route::get('/downloads/documents/{filename}', [MediaController::class, 'downloadDocument'])
    ->where('filename', '[A-Za-z0-9._-]+')
    ->middleware('signed:relative')
    ->name('media.documents.download');

Route::get('/downloads/{folder}/{filename}', [MediaController::class, 'download'])
    ->where('folder', 'portfolio|avatars')
    ->where('filename', '[A-Za-z0-9._-]+');
