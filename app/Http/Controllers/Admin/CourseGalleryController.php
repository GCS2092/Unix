<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CourseGalleryController extends Controller
{
    private const MAX = 12;

    public function add(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($course->canBeManagedBy($request->user()), 403);

        $request->validate(['image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:4096']]);

        if ($course->images()->count() >= self::MAX) {
            throw ValidationException::withMessages(['image' => 'Maximum '.self::MAX.' images supplémentaires.']);
        }

        $name = basename(\App\Support\ImageProcessor::store($request->file('image'), 'course-covers'));
        $course->images()->create([
            'path' => $name,
            'position' => ((int) $course->images()->max('position')) + 1,
        ]);

        return response()->json(['data' => CourseResource::make($course->fresh())]);
    }

    public function remove(Request $request, Course $course, int $image): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($course->canBeManagedBy($request->user()), 403);

        $row = $course->images()->findOrFail($image);
        \App\Support\MediaDisk::disk()->delete('course-covers/'.basename((string) $row->path));
        $row->delete();

        return response()->json(['data' => CourseResource::make($course->fresh())]);
    }
}