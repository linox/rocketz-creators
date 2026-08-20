<?php

use App\Http\Controllers\Api\MediaController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/downloads/{folder}/{filename}', [MediaController::class, 'download'])
    ->where('filename', '[A-Za-z0-9._-]+');
