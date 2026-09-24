<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $provider
 * @property string $event_key
 * @property array<array-key, mixed>|null $payload
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentWebhookEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentWebhookEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentWebhookEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentWebhookEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentWebhookEvent whereEventKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentWebhookEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentWebhookEvent wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentWebhookEvent whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentWebhookEvent whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
class PaymentWebhookEvent extends Model
{
    protected $fillable = [
        'provider',
        'event_key',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }
}
