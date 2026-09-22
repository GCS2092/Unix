<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Enrollment */
class EnrollmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'progress' => $this->progress,
            'completed_at' => $this->completed_at,
            'course' => CourseResource::make($this->whenLoaded('course')),
            'certificate' => CertificateResource::make($this->whenLoaded('certificate')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
