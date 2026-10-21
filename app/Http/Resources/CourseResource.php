<?php

namespace App\Http\Resources;

use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Course */
class CourseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    private function lookup(Request $request): array
    {
        $bag = $request->attributes;
        if (! $bag->has('course_lookup')) {
            $slugs = [];
            $ids = [];
            $products = \App\Models\Product::query()->without('images', 'category')
                ->whereNotNull('course_id')->orderBy('id')
                ->get(['id', 'slug', 'course_id', 'is_published']);
            foreach ($products as $p) {
                $ids[$p->course_id] ??= $p->id;
                if ($p->is_published) {
                    $slugs[$p->course_id] ??= $p->slug;
                }
            }
            $quizzes = array_fill_keys(
                \App\Models\Quiz::query()->where('is_published', true)->pluck('course_id')->all(),
                true,
            );
            $bag->set('course_lookup', ['slugs' => $slugs, 'ids' => $ids, 'quizzes' => $quizzes]);
        }

        return $bag->get('course_lookup');
    }

    public function toArray(Request $request): array
    {
        $isAdmin = (bool) $request->user()?->is_admin;
        $lk = $this->lookup($request);
        // L'API admin renvoie les valeurs brutes (a editer) ; le site recoit la langue courante.
        $adm = $request->is('api/v1/admin/*');

        return [
            'id' => $this->id,
            'title' => $adm ? $this->title : $this->localized('title'),
            'slug' => $this->slug,
            'duration_seconds' => $this->duration_seconds,
            'description' => $adm ? $this->description : $this->localized('description'),
            'objectives' => $adm ? $this->objectives : $this->localized('objectives'),
            'program' => $adm ? $this->program : $this->localized('program'),
            'audience' => $adm ? $this->audience : $this->localized('audience'),
            'prerequisites' => $adm ? $this->prerequisites : $this->localized('prerequisites'),
            'title_en' => $this->when($adm, $this->title_en),
            'description_en' => $this->when($adm, $this->description_en),
            'objectives_en' => $this->when($adm, $this->objectives_en),
            'program_en' => $this->when($adm, $this->program_en),
            'audience_en' => $this->when($adm, $this->audience_en),
            'prerequisites_en' => $this->when($adm, $this->prerequisites_en),
            'price' => $this->price,
            'teacher' => $this->instructor?->name,
            'image_url' => $this->cover_image
                ? rtrim((string) config('app.url'), '/').'/api/v1/catalog/courses/media/'.rawurlencode(basename((string) $this->cover_image))
                : null,
            'images' => array_values(array_filter([
                $this->cover_image
                    ? rtrim((string) config('app.url'), '/').'/api/v1/catalog/courses/media/'.rawurlencode(basename((string) $this->cover_image))
                    : null,
                ...$this->images->map(fn ($i) => $i->url())->all(),
            ])),
            'gallery' => $this->when($isAdmin, fn () => $this->images->map(fn ($i) => ['id' => $i->id, 'url' => $i->url()])->values()->all()),
            'share_url' => rtrim((string) config('app.url'), '/').'/c/'.$this->slug,
            'product_slug' => $lk['slugs'][$this->id] ?? null,
            'has_live' => filled($this->livekit_room),
            'has_quiz' => isset($lk['quizzes'][$this->id]),
            'stream_video_id' => $this->when($isAdmin, $this->stream_video_id),
            'livekit_room' => $this->when($isAdmin, $this->livekit_room),
            'is_published' => $this->when($isAdmin, $this->is_published),
            'instructor_id' => $this->when($isAdmin, $this->instructor_id),
            'product_id' => $this->when($isAdmin, fn () => $lk['ids'][$this->id] ?? null),
            'enrollments_count' => $this->when($isAdmin && array_key_exists('enrollments_count', $this->resource->getAttributes()), fn () => (int) $this->enrollments_count),
            'completed_count' => $this->when($isAdmin && array_key_exists('completed_count', $this->resource->getAttributes()), fn () => (int) $this->completed_count),
            'avg_progress' => $this->when($isAdmin && array_key_exists('avg_progress', $this->resource->getAttributes()), fn () => (int) round((float) $this->avg_progress)),
            'instructor_name' => $this->when($isAdmin && $this->relationLoaded('instructor'), fn () => $this->instructor?->name),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
