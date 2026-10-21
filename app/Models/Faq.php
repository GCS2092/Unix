<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Faq extends Model
{
    protected $fillable = [
        'space', 'category_fr', 'category_en', 'question_fr', 'answer_fr',
        'question_en', 'answer_en', 'position', 'is_published',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'position' => 'integer',
    ];
}