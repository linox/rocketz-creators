<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'message' => $this->message,
            'type' => $this->type?->value,
            'target_role' => $this->target_role?->value,
            'link' => $this->link,
            'read' => (bool) $this->read,
            'creator_id' => $this->creator_id,
            'campaign_id' => $this->campaign_id,
            'recurring_contract_id' => $this->recurring_contract_id,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
