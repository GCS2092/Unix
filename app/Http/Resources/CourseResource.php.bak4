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
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description,
            'price' => $this->price,
            'stream_video_id' => $this->when(
                $request->user()?->is_admin,
                $this->stream_video_id,
            ),
            'livekit_room' => $this->when(
                $request->user()?->is_admin,
                $this->livekit_room,
            ),
            'is_published' => $this->when(
                $request->user()?->is_admin,
                $this->is_published,
            ),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
