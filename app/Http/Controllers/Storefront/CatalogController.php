<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Http\Resources\ProductResource;
use App\Models\Course;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    public function courses(Request $request): JsonResponse
    {
        $courses = Course::query()
            ->with('instructor:id,name')
            ->where('is_published', true)
            ->latest('id')
            ->paginate(min(max($request->integer('per_page', 20), 1), 100));

        return response()->json([
            'data' => CourseResource::collection($courses),
            'meta' => [
                'current_page' => $courses->currentPage(),
                'last_page' => $courses->lastPage(),
                'total' => $courses->total(),
            ],
        ]);
    }

    public function course(Request $request, Course $course): JsonResponse
    {
        $this->authorize('view', $course);

        return response()->json([
            'data' => CourseResource::make($course),
        ]);
    }

    public function products(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $sort = (string) $request->query('sort', 'new');

        $query = Product::query()->where('is_published', true);

        if ($search !== '') {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
            $query->where(function ($q) use ($like) {
                $q->where('name', 'like', $like)->orWhere('name_en', 'like', $like);
            });
        }

        $cat = trim((string) $request->query('category', ''));
        if ($cat !== '') {
            $query->whereHas('category', fn ($q) => $q->where('slug', $cat)->where('is_active', true));
        }

        $minPrice = $request->query('min_price');
        $maxPrice = $request->query('max_price');
        if (is_numeric($minPrice) && (int) $minPrice > 0) {
            $query->where('price', '>=', (int) $minPrice);
        }
        if (is_numeric($maxPrice) && (int) $maxPrice > 0) {
            $query->where('price', '<=', (int) $maxPrice);
        }

        if ($request->boolean('in_stock')) {
            $query->where('stock', '>', 0);
        }
        if ($request->boolean('new')) {
            $query->where('created_at', '>=', now()->subDays(14));
        }

        match ($sort) {
            'price_asc' => $query->orderBy('price')->orderByDesc('id'),
            'price_desc' => $query->orderByDesc('price')->orderByDesc('id'),
            default => $query->latest('id'),
        };

        $products = $query->paginate(20)->withQueryString();

        return response()->json([
            'data' => ProductResource::collection($products),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    public function product(Request $request, Product $product): JsonResponse
    {
        $this->authorize('view', $product);

        return response()->json([
            'data' => ProductResource::make($product),
        ]);
    }
}
