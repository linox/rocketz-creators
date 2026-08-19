<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForwardAuthorizationHeader
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->headers->get('Authorization')) {
            return $next($request);
        }

        $token = $request->server->get('HTTP_AUTHORIZATION')
            ?? $request->server->get('REDIRECT_HTTP_AUTHORIZATION')
            ?? $request->header('X-Auth-Token');

        if (is_string($token) && $token !== '') {
            if (! str_starts_with($token, 'Bearer ') && ! str_starts_with($token, 'Basic ')) {
                $token = 'Bearer '.$token;
            }

            $request->headers->set('Authorization', $token);
        }

        return $next($request);
    }
}
