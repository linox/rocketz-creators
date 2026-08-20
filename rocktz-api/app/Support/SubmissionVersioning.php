<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

class SubmissionVersioning
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public static function append(Model $model, string $stage, array $payload = []): int
    {
        $counterField = $stage === 'script' ? 'script_version' : 'video_version';
        $next = ((int) ($model->getAttribute($counterField) ?? 0)) + 1;
        $versions = $model->getAttribute('submission_versions');
        if (! is_array($versions)) {
            $versions = [];
        }

        $versions[] = array_merge([
            'version' => $next,
            'stage' => $stage,
            'submitted_at' => now()->toIso8601String(),
        ], $payload);

        $model->setAttribute($counterField, $next);
        $model->setAttribute('submission_versions', $versions);
        $model->save();

        return $next;
    }
}
