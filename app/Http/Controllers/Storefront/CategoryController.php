<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Category::query()
            ->where('is_active', true)
            ->withCount(['products as products_count' => fn ($q) => $q->where('is_published', true)])
            ->orderBy('position')->orderBy('id')->get()
            ->filter(fn (Category $c) => (int) $c->products_count > 0)
            ->map(fn (Category $c) => [
                'id' => $c->id,
                'name' => $c->localizedName(),
                'slug' => $c->slug,
                'products_count' => (int) $c->products_count,
            ])->values();

        return response()->json(['data' => $rows]);
    }
}