<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAttempt extends Model
{
    protected $fillable = ['quiz_id', 'enrollment_id', 'score', 'passed', 'answers'];

    protected function casts(): array
    {
        return ['passed' => 'boolean', 'answers' => 'array'];
    }
}