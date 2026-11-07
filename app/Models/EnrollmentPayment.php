<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EnrollmentPayment extends Model
{
    protected $fillable = ['enrollment_id', 'amount', 'method', 'purpose', 'reference', 'paid_at', 'recorded_by', 'order_id', 'note'];

    protected function casts(): array
    {
        return ['paid_at' => 'datetime', 'amount' => 'integer'];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }
}