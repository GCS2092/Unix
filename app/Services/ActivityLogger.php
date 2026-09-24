<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class ActivityLogger
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function log(?User $actor, string $action, ?Model $subject = null, array $metadata = []): ActivityLog
    {
        return ActivityLog::query()->create([
            'user_id' => $actor?->id,
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'metadata' => $metadata,
        ]);
    }
}
