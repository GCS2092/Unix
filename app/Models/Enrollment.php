<?php

namespace App\Models;

use Database\Factories\EnrollmentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property int $user_id
 * @property int $course_id
 * @property int $progress
 * @property Carbon|null $completed_at
 * @property-read Certificate|null $certificate
 * @property-read Course $course
 * @property-read User $user
 *
 * @method static \Database\Factories\EnrollmentFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment whereCourseId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment whereProgress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Enrollment whereUserId($value)
 *
 * @mixin \Eloquent
 */
class Enrollment extends Model
{
    /** @use HasFactory<EnrollmentFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'course_id',
        'progress',
        'completed_at',
        'watch_seconds',
        'last_heartbeat_at',
        'bonus_attempts',
        'agreed_price',
        'payment_tracked',
        'access_override',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
            'last_heartbeat_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function certificate(): HasOne
    {
        return $this->hasOne(Certificate::class);
    }

    /** @var array{required: bool, passed: bool}|null */
    private ?array $examState = null;

    /** Charge en 2 requetes l'etat de l'examen d'une liste d'inscriptions (evite 2 requetes par inscription). */
    public static function preloadExamState(iterable $enrollments): void
    {
        $list = collect($enrollments)->values();
        if ($list->isEmpty()) {
            return;
        }
        $required = Quiz::query()->where('is_published', true)
            ->whereIn('course_id', $list->pluck('course_id')->unique())
            ->pluck('course_id')->flip();
        $passed = QuizAttempt::query()->where('passed', true)
            ->whereIn('enrollment_id', $list->pluck('id'))
            ->pluck('enrollment_id')->flip();

        foreach ($list as $e) {
            $e->examState = ['required' => $required->has($e->course_id), 'passed' => $passed->has($e->id)];
        }
    }

    public function examRequired(): bool
    {
        if ($this->examState !== null) {
            return $this->examState['required'];
        }

        return Quiz::query()->where('course_id', $this->course_id)->where('is_published', true)->exists();
    }

    public function examPassed(): bool
    {
        if ($this->examState !== null) {
            return ! $this->examState['required'] || $this->examState['passed'];
        }

        if (! $this->examRequired()) {
            return true;
        }

        return QuizAttempt::query()->where('enrollment_id', $this->id)->where('passed', true)->exists();
    }

    /** Video terminee ET examen reussi (si le cours en a un). */
    public function canCertify(): bool
    {
        return $this->isCompleted() && $this->examPassed();
    }

    public function isCompleted(): bool
    {
        return $this->progress >= 100 || $this->completed_at !== null;
    }
}
