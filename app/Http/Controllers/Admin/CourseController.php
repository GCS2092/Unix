<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Services\ActivityLogger;
use Illuminate\Validation\Rule;

class CourseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Course::class);

        $perPage = min(max($request->integer('per_page', 20), 1), 100);
        $q = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', '');

        $courses = Course::query()
            ->with('instructor:id,name')
            ->withCount('enrollments')
            ->withCount(['enrollments as completed_count' => fn ($w) => $w->where(
                fn ($x) => $x->where('progress', '>=', 100)->orWhereNotNull('completed_at'),
            )])
            ->withAvg('enrollments as avg_progress', 'progress')
            ->managedBy($request->user())
            ->when($status === 'published', fn ($w) => $w->where('is_published', true))
            ->when($status === 'draft', fn ($w) => $w->where('is_published', false))
            ->when($q !== '', fn ($w) => $w->where('title', 'like', '%'.addcslashes($q, '%_\\').'%'))
            ->latest('id')
            ->paginate($perPage);

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
            'product_id' => ['sometimes', 'nullable', 'integer', 'exists:products,id'],
        ]);

        if (! isset($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['title']).'-'.Str::random(6);
        }

        // Un formateur est toujours propriétaire de ce qu'il crée
        if ($request->user()->isInstructorOnly()) {
            $validated['instructor_id'] = $request->user()->id;
        }

        // pl-store
        $hasProduct = array_key_exists('product_id', $validated);
        $productId = $validated['product_id'] ?? null;
        unset($validated['product_id']);

        $course = Course::query()->create($validated);

        if ($hasProduct && ! $request->user()->isInstructorOnly()) {
            $this->linkProduct($course, $productId);
        }

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
            'product_id' => ['sometimes', 'nullable', 'integer', 'exists:products,id'],
        ]);

        // Seuls formation et super peuvent réattribuer un cours
        if ($request->user()->isInstructorOnly()) {
            unset($validated['instructor_id']);
        }

        // pl-update
        $hasProduct = array_key_exists('product_id', $validated);
        $productId = $validated['product_id'] ?? null;
        unset($validated['product_id']);

        $course->update($validated);

        if ($hasProduct && ! $request->user()->isInstructorOnly()) {
            $this->linkProduct($course, $productId);
        }

        return response()->json([
            'data' => CourseResource::make($course->fresh()),
        ]);
    }

    public function productOptions(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Course::class);
        abort_if($request->user()->isInstructorOnly(), 403);

        return response()->json([
            'data' => \App\Models\Product::query()->without('images', 'category')
                ->orderBy('name')->get(['id', 'name', 'course_id']),
        ]);
    }

    /** Un seul produit par cours : on delie l'ancien puis on lie le nouveau. */
    private function linkProduct(Course $course, ?int $productId): void
    {
        \Illuminate\Support\Facades\DB::transaction(function () use ($course, $productId): void {
            \App\Models\Product::query()->where('course_id', $course->id)->update(['course_id' => null]);
            if ($productId !== null) {
                \App\Models\Product::query()->whereKey($productId)->update(['course_id' => $course->id]);
            }
        });
    }

    public function duplicate(Request $request, Course $course, ActivityLogger $activity): JsonResponse
    {
        $this->authorize('create', Course::class);
        abort_unless($course->canBeManagedBy($request->user()), 403);

        // Copie du contenu uniquement : ni salle live, ni jeton d'invitation, ni seances, ni inscrits
        $copy = Course::query()->create([
            'title' => Str::limit($course->title, 240, '').' (copie)',
            'slug' => Str::slug(Str::limit($course->title, 200, '')).'-'.Str::random(6),
            'description' => $course->description,
            'price' => $course->price,
            'stream_video_id' => $course->stream_video_id,
            'livekit_room' => null,
            'duration_seconds' => $course->duration_seconds,
            'instructor_id' => $request->user()->isInstructorOnly() ? $request->user()->id : $course->instructor_id,
            'is_published' => false,
        ]);

        $activity->log($request->user(), 'course.duplicated', $copy, ['source_id' => $course->id]);

        return response()->json(['data' => CourseResource::make($copy)], 201);
    }

    public function destroy(Request $request, Course $course): JsonResponse
    {
        $this->authorize('delete', $course);
        abort_unless($course->canBeManagedBy($request->user()), 403);

        $course->delete();

        return response()->json(null, 204);
    }
}

