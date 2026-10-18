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
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Course::class);

        $perPage = min(max($request->integer('per_page', 20), 1), 100);
        $courses = Course::query()->managedBy($request->user())->latest('id')->paginate($perPage);

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
            'duration_seconds' => ['nullable', 'integer', 'min:1', 'max:86400'],
            'is_published' => ['sometimes', 'boolean'],
            'instructor_id' => ['sometimes', 'nullable', Rule::exists('users', 'id')->where('is_admin', true)->where('admin_scope', 'instructor')],
        ]);

        if (! isset($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['title']).'-'.Str::random(6);
        }

        // Un formateur est toujours propriétaire de ce qu'il crée
        if ($request->user()->isInstructorOnly()) {
            $validated['instructor_id'] = $request->user()->id;
        }

        $course = Course::query()->create($validated);

        return response()->json([
            'data' => CourseResource::make($course),
        ], 201);
    }

    public function show(Request $request, Course $course): JsonResponse
    {
        $this->authorize('view', $course);
        abort_unless($course->canBeManagedBy($request->user()), 403);

        return response()->json([
            'data' => CourseResource::make($course),
        ]);
    }

    public function update(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($course->canBeManagedBy($request->user()), 403);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('courses', 'slug')->ignore($course->id)],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'integer', 'min:0'],
            'stream_video_id' => ['nullable', 'string', 'max:255'],
            'livekit_room' => ['nullable', 'string', 'max:255'],
            'duration_seconds' => ['nullable', 'integer', 'min:1', 'max:86400'],
            'is_published' => ['sometimes', 'boolean'],
            'instructor_id' => ['sometimes', 'nullable', Rule::exists('users', 'id')->where('is_admin', true)->where('admin_scope', 'instructor')],
        ]);

        // Seuls formation et super peuvent réattribuer un cours
        if ($request->user()->isInstructorOnly()) {
            unset($validated['instructor_id']);
        }

        $course->update($validated);

        return response()->json([
            'data' => CourseResource::make($course->fresh()),
        ]);
    }

    public function destroy(Request $request, Course $course): JsonResponse
    {
        $this->authorize('delete', $course);
        abort_unless($course->canBeManagedBy($request->user()), 403);

        $course->delete();

        return response()->json(null, 204);
    }
}
