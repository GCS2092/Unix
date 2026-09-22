<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CourseController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', Course::class);

        $courses = Course::query()->latest('id')->paginate(20);

        return response()->json([
            'data' => CourseResource::collection($courses),
            'meta' => [
                'current_page' => $courses->currentPage(),
                'last_page' => $courses->lastPage(),
                'total' => $courses->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Course::class);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', 'unique:courses,slug'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'integer', 'min:0'],
            'stream_video_id' => ['nullable', 'string', 'max:255'],
            'livekit_room' => ['nullable', 'string', 'max:255'],
            'is_published' => ['sometimes', 'boolean'],
        ]);

        if (! isset($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['title']).'-'.Str::random(6);
        }

        $course = Course::query()->create($validated);

        return response()->json([
            'data' => CourseResource::make($course),
        ], 201);
    }

    public function show(Course $course): JsonResponse
    {
        $this->authorize('view', $course);

        return response()->json([
            'data' => CourseResource::make($course),
        ]);
    }

    public function update(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('courses', 'slug')->ignore($course->id)],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'integer', 'min:0'],
            'stream_video_id' => ['nullable', 'string', 'max:255'],
            'livekit_room' => ['nullable', 'string', 'max:255'],
            'is_published' => ['sometimes', 'boolean'],
        ]);

        $course->update($validated);

        return response()->json([
            'data' => CourseResource::make($course->fresh()),
        ]);
    }

    public function destroy(Course $course): JsonResponse
    {
        $this->authorize('delete', $course);

        $course->delete();

        return response()->json(null, 204);
    }
}
