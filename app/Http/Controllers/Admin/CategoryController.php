<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Category::query()->withCount('products')->orderBy('position')->orderBy('id')->get()
            ->map(fn (Category $c) => $this->row($c))->values();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'name_en' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $base = Str::slug($data['name']) ?: 'categorie';
        $slug = $base;
        for ($i = 2; Category::query()->where('slug', $slug)->exists(); $i++) {
            $slug = $base.'-'.$i;
        }

        $category = Category::query()->create($data + [
            'slug' => $slug,
            'position' => (int) Category::query()->max('position') + 1,
        ]);
        $activity->log($request->user(), 'category.created', $category, $data);

        return response()->json(['data' => $this->row($category->loadCount('products'))], 201);
    }

    /** Le slug ne change pas au renommage : les liens existants restent valides. */
    public function update(Request $request, Category $category, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'name_en' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category->update($data);
        $activity->log($request->user(), 'category.updated', $category, $data);

        return response()->json(['data' => $this->row($category->loadCount('products'))]);
    }

    /** Les produits de la categorie supprimee passent sans categorie (nullOnDelete). */
    public function destroy(Request $request, Category $category, ActivityLogger $activity): JsonResponse
    {
        $activity->log($request->user(), 'category.deleted', null, ['name' => $category->name]);
        $category->delete();

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    private function row(Category $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'name_en' => $c->name_en,
            'slug' => $c->slug,
            'is_active' => (bool) $c->is_active,
            'products_count' => (int) ($c->products_count ?? 0),
        ];
    }
}