<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CourseCoverController extends Controller
{
    public function upload(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($course->canBeManagedBy($request->user()), 403);

        $request->validate(['image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:4096']]);

        $name = basename($request->file('image')->store('course-covers', ['disk' => \App\Support\MediaDisk::name()]));
        $this->deleteFile($course->cover_image);
        $course->forceFill(['cover_image' => $name])->save();

        return response()->json(['data' => CourseResource::make($course->fresh())]);
    }

    public function remove(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($course->canBeManagedBy($request->user()), 403);

        $this->deleteFile($course->cover_image);
        $course->forceFill(['cover_image' => null])->save();

        return response()->json(['data' => CourseResource::make($course->fresh())]);
    }

    private function deleteFile(mixed $name): void
    {
        if (is_string($name) && $name !== '') {
            \App\Support\MediaDisk::disk()->delete('course-covers/'.basename($name));
        }
    }
}