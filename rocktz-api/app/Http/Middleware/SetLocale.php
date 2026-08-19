<?php

namespace App\Http\Middleware;

use App\Support\AppLocale;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $locale = AppLocale::fromRequestHeader($request->header('Accept-Language'));
        App::setLocale(AppLocale::laravelLocale($locale));

        return $next($request);
    }
}
