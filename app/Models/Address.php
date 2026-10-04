<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Address extends Model
{
    protected $fillable = [
        'user_id', 'label', 'recipient_name', 'phone', 'city',
        'district', 'address', 'landmark', 'is_default',
    ];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }
}