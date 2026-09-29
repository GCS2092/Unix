<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $products = Product::query()->latest('id')->paginate(20);

        return response()->json([
            'data' => ProductResource::collection($products),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Product::class);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', 'unique:products,slug'],
            'description' => ['nullable', 'string'],
            'name_en' => ['nullable', 'string', 'max:255'],
            'description_en' => ['nullable', 'string'],
            'image_link' => ['nullable', 'url:http,https', 'max:2048'],
            'price' => ['required', 'integer', 'min:0'],
            'stock' => ['sometimes', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
        ]);

        if (! isset($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']).'-'.Str::random(6);
        }

        $product = Product::query()->create($validated);

        return response()->json([
            'data' => ProductResource::make($product),
        ], 201);
    }

    public function show(Product $product): JsonResponse
    {
        $this->authorize('view', $product);

        return response()->json([
            'data' => ProductResource::make($product),
        ]);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('products', 'slug')->ignore($product->id)],
            'description' => ['nullable', 'string'],
            'name_en' => ['nullable', 'string', 'max:255'],
            'description_en' => ['nullable', 'string'],
            'image_link' => ['nullable', 'url:http,https', 'max:2048'],
            'price' => ['sometimes', 'integer', 'min:0'],
            'stock' => ['sometimes', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
        ]);

        if (! empty($validated['image_link']) && $product->image_path) {
            Storage::disk('public')->delete($product->image_path);
            $validated['image_path'] = null;
        }

        $product->update($validated);

        return response()->json([
            'data' => ProductResource::make($product->fresh()),
        ]);
    }

    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        $path = $request->file('image')->store('products', 'public');
        $product->update(['image_path' => $path, 'image_link' => null]);

        return response()->json(['data' => ProductResource::make($product->fresh())]);
    }

    public function removeImage(Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        $product->update(['image_path' => null, 'image_link' => null]);

        return response()->json(['data' => ProductResource::make($product->fresh())]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->authorize('delete', $product);

        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        $product->delete();

        return response()->json(null, 204);
    }
}
