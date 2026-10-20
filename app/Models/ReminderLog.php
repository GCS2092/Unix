<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReminderLog extends Model
{
    public $timestamps = false;

    protected $fillable = ['enrollment_id', 'type', 'sent_at'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }

    /** Un rappel est du si on n'a pas atteint le maximum et que le dernier date de plus de $minDays jours. */
    public static function isDue(int $enrollmentId, string $type, int $minDays, int $max): bool
    {
        $logs = static::query()->where('enrollment_id', $enrollmentId)->where('type', $type);

        if ($logs->count() >= $max) {
            return false;
        }

        $last = (clone $logs)->max('sent_at');

        return $last === null || \Illuminate\Support\Carbon::parse($last)->lt(now()->subDays($minDays));
    }

    public static function record(int $enrollmentId, string $type): void
    {
        static::query()->create(['enrollment_id' => $enrollmentId, 'type' => $type, 'sent_at' => now()]);
    }
}