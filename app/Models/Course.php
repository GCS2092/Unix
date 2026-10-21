<?php

namespace App\Models;

use Database\Factories\CourseFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string $title
 * @property string $slug
 * @property string|null $description
 * @property int $price
 * @property string|null $stream_video_id
 * @property bool $is_published
 * @property string|null $livekit_room
 * @property-read Collection<int, Enrollment> $enrollments
 * @property-read int|null $enrollments_count
 * @property-read Collection<int, OrderItem> $orderItems
 * @property-read int|null $order_items_count
 *
 * @method static \Database\Factories\CourseFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course whereIsPublished($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course whereLivekitRoom($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course wherePrice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course whereStreamVideoId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Course whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
class Course extends Model
{
    /** @use HasFactory<CourseFactory> */
    use HasFactory;

    protected $with = ['images'];

    protected $fillable = [
        'title',
        'slug',
        'description',
        'price',
        'stream_video_id',
        'livekit_room',
        'title_en',
        'description_en',
        'objectives',
        'objectives_en',
        'program',
        'program_en',
        'audience',
        'audience_en',
        'prerequisites',
        'prerequisites_en',
        'duration_seconds',
        'instructor_id',
        'is_published',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (Course $c): void {
            $disk = \App\Support\MediaDisk::name();
            foreach ($c->images as $img) {
                \App\Support\ImageProcessor::delete('course-covers/'.basename((string) $img->path), $disk);
            }
            if ($c->cover_image) {
                \App\Support\ImageProcessor::delete('course-covers/'.basename((string) $c->cover_image), $disk);
            }
        });
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function orderItems(): MorphMany
    {
        return $this->morphMany(OrderItem::class, 'itemable');
    }

    public function instructor(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'instructor_id');
    }

    /** Cours gérables par cet utilisateur : tous, sauf pour un formateur (ses cours seulement). */
    public function scopeManagedBy(\Illuminate\Database\Eloquent\Builder $query, User $user): \Illuminate\Database\Eloquent\Builder
    {
        return $user->isInstructorOnly() ? $query->where('instructor_id', $user->id) : $query;
    }

    public function canBeManagedBy(User $user): bool
    {
        return ! $user->isInstructorOnly() || (int) $this->instructor_id === (int) $user->id;
    }

    /** Valeur dans la langue courante, avec repli sur le francais. */
    public function localized(string $field): ?string
    {
        $en = app()->getLocale() === 'en' ? ($this->{$field.'_en'} ?? null) : null;

        return filled($en) ? $en : ($this->{$field} ?? null);
    }

    public function images(): HasMany
    {
        return $this->hasMany(CourseImage::class)->orderBy('position')->orderBy('id');
    }

    public function quiz(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Quiz::class);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}


