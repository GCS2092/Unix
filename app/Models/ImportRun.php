<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportRun extends Model
{
    protected $fillable = ['user_id', 'kind', 'path', 'ext', 'options', 'status', 'report', 'error', 'started_at', 'finished_at'];

    protected function casts(): array
    {
        return ['options' => 'array', 'report' => 'array', 'started_at' => 'datetime', 'finished_at' => 'datetime'];
    }
}