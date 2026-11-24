<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        if ($this->sendHsts($request)) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        if ($request->routeIs('media.documents.preview')) {
            $response->headers->remove('X-Frame-Options');
            $response->headers->set('Content-Security-Policy', 'frame-ancestors '.$this->frameAncestors());

            return $response;
        }

        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Content-Security-Policy', "frame-ancestors 'none'");

        return $response;
    }

    private function sendHsts(Request $request): bool
    {
        $host = $request->getHost();
        if (in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
            return false;
        }

        return $request->secure() || app()->environment('production');
    }

    private function frameAncestors(): string
    {
        $origins = array_values(array_filter(
            config('cors.allowed_origins', []),
            fn ($origin) => is_string($origin) && $origin !== '' && $origin !== '*',
        ));

        return $origins === [] ? "'none'" : implode(' ', $origins);
    }
}
