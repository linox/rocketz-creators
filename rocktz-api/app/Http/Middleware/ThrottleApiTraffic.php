<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Symfony\Component\HttpFoundation\Response;

class ThrottleApiTraffic
{
    public function __construct(private readonly ThrottleRequests $throttle) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('OPTIONS')) {
            return $next($request);
        }

        return $this->throttle->handle($request, $next, $this->limiterFor($request));
    }

    private function limiterFor(Request $request): string
    {
        if ($request->is('api/media', 'api/media/*')) {
            return 'media-upload';
        }

        if ($request->isMethod('GET') || $request->isMethod('HEAD')) {
            return 'api-read';
        }

        return 'api-write';
    }
}
