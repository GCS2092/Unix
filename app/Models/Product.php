<?php

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property int $price
 * @property int $stock
 * @property bool $is_published
 * @property-read Collection<int, OrderItem> $orderItems
 * @property-read int|null $order_items_count
 *
 * @method static \Database\Factories\ProductFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereIsPublished($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product wherePrice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereStock($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Product whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'stock',
        'is_published',
        'name_en',
        'description_en',
        'category_id',
        'image_path',
        'image_link',
        'image_disk',
        'specs',
        'specs_en',
        'delivery_info',
        'delivery_info_en',
        'course_id',
    ];

    protected $with = ['images', 'category'];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
        ];
    }

    public function orderItems(): MorphMany
    {
        return $this->morphMany(OrderItem::class, 'itemable');
    }

    public function category(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function imageUrl(): ?string
    {
        if ($this->image_path) {
            return \Illuminate\Support\Facades\Storage::disk($this->image_disk ?: 'public')->url($this->image_path);
        }

        return $this->image_link ?: null;
    }

    public function images(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('position')->orderBy('id');
    }

    protected static function booted(): void
    {
        // Le fichier remplace ou retire : l'ancien est supprime (avec sa miniature)
        static::updating(function (Product $p): void {
            if ($p->isDirty('image_path') && $p->getOriginal('image_path')) {
                \App\Support\ImageProcessor::delete($p->getOriginal('image_path'), $p->getOriginal('image_disk') ?: 'public');
            }
        });
        static::deleting(function (Product $p): void {
            foreach ($p->images as $img) {
                $img->delete();
            }
            \App\Support\ImageProcessor::delete($p->image_path, $p->image_disk ?: 'public');
        });
    }

    public function thumbUrl(): ?string
    {
        if ($this->image_path && ($t = \App\Support\ImageProcessor::thumbPath($this->image_path))) {
            return \Illuminate\Support\Facades\Storage::disk($this->image_disk ?: 'public')->url($t);
        }

        return $this->imageUrl();
    }

    /** Champ texte dans la langue courante (suffixe _en), avec repli sur le francais. */
    public function localizedExtra(string $field): ?string
    {
        $en = app()->getLocale() === 'en' ? ($this->{$field.'_en'} ?? null) : null;

        return filled($en) ? $en : ($this->{$field} ?? null);
    }

    public function localizedName(): string
    {
        return app()->getLocale() === 'en' && filled($this->name_en) ? $this->name_en : $this->name;
    }

    public function localizedDescription(): ?string
    {
        return app()->getLocale() === 'en' && filled($this->description_en) ? $this->description_en : $this->description;
    }

    public function stockMovements(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(StockMovement::class)->latest('id');
    }

    /** Stock faible = au moins 1 unite ET au plus le seuil (0 = rupture, compte a part). */
    public function scopeLowStock(\Illuminate\Database\Eloquent\Builder $query, int $threshold): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where('stock', '>', 0)->where('stock', '<=', $threshold);
    }

    public function isInStock(int $quantity = 1): bool
    {
        return $this->stock >= $quantity;
    }
}
