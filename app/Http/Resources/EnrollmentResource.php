<?php

namespace App\Http\Resources;

use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Enrollment */
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
            'exam_required' => $this->examRequired(),
            'exam_passed' => $this->examPassed(),
            'payment' => $this->payment_tracked ? \App\Services\EnrollmentBalance::summary($this->resource) : null,
            'access_granted' => \App\Services\EnrollmentBalance::hasAccess($this->resource),
            'access_block' => \App\Services\EnrollmentBalance::blockReason($this->resource),
            'course' => CourseResource::make($this->whenLoaded('course')),
            'certificate' => CertificateResource::make($this->whenLoaded('certificate')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
