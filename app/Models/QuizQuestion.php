<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizQuestion extends Model
{
    protected $fillable = ['quiz_id', 'prompt', 'options', 'correct_index', 'position'];

    protected function casts(): array
    {
        return ['options' => 'array'];
    }
}