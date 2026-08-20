<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

class RevisionHistory
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public static function append(Model $model, string $stage, string $note, array $payload = []): void
    {
        $trimmed = trim($note);
        if ($trimmed === '') {
            return;
        }

        $history = $model->getAttribute('revision_history');
        if (! is_array($history)) {
            $history = [];
        }

        $history[] = array_merge([
            'stage' => $stage,
            'note' => $trimmed,
            'requested_at' => now()->toIso8601String(),
        ], $payload);

        $model->setAttribute('revision_history', $history);
    }
}
