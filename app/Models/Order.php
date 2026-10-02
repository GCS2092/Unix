<?php

namespace App\Models;

use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property int|null $user_id
 * @property string|null $guest_email
 * @property string|null $guest_name
 * @property OrderStatus $status
 * @property int $total
 * @property int $subtotal
 * @property int $delivery_fee
 * @property string $currency
 * @property string|null $payment_transaction_id
 * @property Carbon|null $paid_at
 * @property string|null $phone
 * @property string|null $delivery_method
 * @property string|null $delivery_zone
 * @property string|null $city
 * @property string|null $district
 * @property string|null $address
 * @property string|null $landmark
 * @property string|null $note
 * @property-read Collection<int, OrderItem> $items
 * @property-read int|null $items_count
 * @property-read User|null $user
 *
 * @method static \Database\Factories\OrderFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Order newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Order newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Order query()
 *
 * @mixin \Eloquent
 */
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'guest_email',
        'guest_name',
        'status',
        'total',
        'subtotal',
        'delivery_fee',
        'currency',
        'payment_transaction_id',
        'paid_at',
        'locale',
        'phone',
        'delivery_method',
        'delivery_zone',
        'city',
        'district',
        'address',
        'landmark',
        'note',
        'fulfillment_status',
        'stock_reserved',
        'reservation_expires_at',
        'stock_conflict',
    ];

    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'paid_at' => 'datetime',
            'fulfillment_status' => FulfillmentStatus::class,
            'stock_reserved' => 'boolean',
            'stock_conflict' => 'boolean',
            'reservation_expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function isPaid(): bool
    {
        return $this->status === OrderStatus::Paid;
    }

    public function recipientEmail(): ?string
    {
        /** @phpstan-ignore nullsafe.neverNull */
        return $this->user?->email ?? $this->guest_email;
    }
}