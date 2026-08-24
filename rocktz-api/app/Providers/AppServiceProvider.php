<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Console\ServeCommand;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            ServeCommand::class,
            \App\Console\Commands\ServeCommand::class,
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        JsonResource::withoutWrapping();

        RateLimiter::for('login', function (Request $request) {
            $email = strtolower((string) $request->input('email'));

            return Limit::perMinute(5)->by($request->ip().'|'.$email);
        });

        RateLimiter::for('auth-public', function (Request $request) {
            return Limit::perMinute(10)->by((string) $request->ip());
        });

        RateLimiter::for('two-factor', function (Request $request) {
            $token = (string) $request->input('challenge_token');

            return Limit::perMinute(8)->by($request->ip().'|'.$token);
        });

        ResetPassword::createUrlUsing(function (object $user, string $token) {
            $frontend = rtrim((string) config('app.frontend_url'), '/');
            $email = urlencode($user->email);

            return "{$frontend}/reset-password?token={$token}&email={$email}";
        });
    }
}
