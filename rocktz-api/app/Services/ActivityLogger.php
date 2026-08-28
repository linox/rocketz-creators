<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use App\Support\ActivityActionResolver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ActivityLogger
{
    /**
     * @var list<string>
     */
    private const REDACT_KEYS = [
        'password',
        'password_confirmation',
        'current_password',
        'token',
        'challenge_token',
        'code',
        'authorization',
        'google_id',
    ];

    /**
     * @param  array<string, mixed>  $properties
     */
    public function record(
        Request $request,
        string $action,
        string $category,
        ?User $user = null,
        array $properties = [],
        int $status = 200,
        ?string $subjectType = null,
        ?int $subjectId = null,
    ): void {
        try {
            $actor = $user ?? $request->user();
            [$routeType, $routeId] = $this->subjectFromRoute($request);

            ActivityLog::query()->create([
                'user_id' => $actor?->id,
                'actor_email' => $actor?->email ?? $this->attemptedEmail($request),
                'actor_name' => $actor?->name,
                'actor_role' => $actor?->role?->value,
                'category' => $category,
                'action' => $action,
                'method' => strtoupper($request->method()),
                'path' => Str::limit($request->path(), 250, ''),
                'status_code' => $status,
                'ip' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 512, ''),
                'subject_type' => $subjectType ?? $routeType,
                'subject_id' => $subjectId ?? $routeId,
                'properties' => $properties === [] ? $this->safeInput($request) : $this->sanitize($properties),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function fromHttp(Request $request, int $status): void
    {
        if ($status < 200 || $status >= 300) {
            return;
        }
        if (ActivityActionResolver::shouldSkip($request)) {
            return;
        }

        $this->record($request, ActivityActionResolver::actionFor($request), 'action', $request->user(), [], $status);
    }

    /**
     * @return array{0: string|null, 1: int|null}
     */
    private function subjectFromRoute(Request $request): array
    {
        $parameters = $request->route()?->parameters() ?? [];
        foreach ($parameters as $key => $value) {
            if ($value instanceof Model) {
                return [class_basename($value), (int) $value->getKey()];
            }
            if (is_numeric($value)) {
                return [Str::studly($key), (int) $value];
            }
        }

        return [null, null];
    }

    /**
     * @return array<string, mixed>
     */
    private function safeInput(Request $request): array
    {
        return $this->sanitize($request->except(self::REDACT_KEYS));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function sanitize(array $data): array
    {
        $out = [];
        foreach ($data as $key => $value) {
            if (! is_string($key)) {
                continue;
            }
            if (in_array(strtolower($key), self::REDACT_KEYS, true)) {
                continue;
            }
            if (is_array($value) || is_object($value)) {
                continue;
            }
            if (is_string($value)) {
                $value = Str::limit($value, 200, '');
            }
            $out[$key] = $value;
            if (count($out) >= 15) {
                break;
            }
        }

        return $out;
    }

    private function attemptedEmail(Request $request): ?string
    {
        $email = $request->input('email');

        return is_string($email) ? Str::lower($email) : null;
    }
}
