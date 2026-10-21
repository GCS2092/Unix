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
    public function toArray(Request $request): array
    {
        $isAdmin = (bool) $request->user()?->is_admin;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'duration_seconds' => $this->duration_seconds,
            'description' => $this->description,
            'price' => $this->price,
            'teacher' => $this->instructor?->name,
            'image_url' => $this->cover_image
                ? rtrim($request->getSchemeAndHttpHost(), '/').'/api/v1/catalog/courses/media/'.rawurlencode(basename((string) $this->cover_image))
                : null,
            'product_slug' => \App\Models\Product::query()->where('course_id', $this->id)->where('is_published', true)->value('slug'),
            'has_live' => filled($this->livekit_room),
            'has_quiz' => \App\Models\Quiz::query()->where('course_id', $this->id)->where('is_published', true)->exists(),
            'stream_video_id' => $this->when($isAdmin, $this->stream_video_id),
            'livekit_room' => $this->when($isAdmin, $this->livekit_room),
            'is_published' => $this->when($isAdmin, $this->is_published),
            'instructor_id' => $this->when($isAdmin, $this->instructor_id),
            'product_id' => $this->when($isAdmin, fn () => \App\Models\Product::query()->where('course_id', $this->id)->value('id')),
            'enrollments_count' => $this->when($isAdmin && array_key_exists('enrollments_count', $this->resource->getAttributes()), fn () => (int) $this->enrollments_count),
            'completed_count' => $this->when($isAdmin && array_key_exists('completed_count', $this->resource->getAttributes()), fn () => (int) $this->completed_count),
            'avg_progress' => $this->when($isAdmin && array_key_exists('avg_progress', $this->resource->getAttributes()), fn () => (int) round((float) $this->avg_progress)),
            'instructor_name' => $this->when($isAdmin && $this->relationLoaded('instructor'), fn () => $this->instructor?->name),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
