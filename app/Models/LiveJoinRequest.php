<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiveJoinRequest extends Model
{
    protected $fillable = ['course_id', 'name', 'secret_hash', 'status', 'decided_at'];

    protected function casts(): array
    {
        return ['decided_at' => 'datetime'];
    }
}