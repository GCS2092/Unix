<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiveSession extends Model
{
    protected $fillable = ['course_id', 'title', 'starts_at', 'note', 'reminded_at', 'created_by'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'reminded_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}