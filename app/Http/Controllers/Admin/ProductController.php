<?php

namespace App\Http\Controllers\Admin;

use App\Enums\StockMovementReason;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $filter = (string) $request->query('stock', '');
        $threshold = (int) config('shop.low_stock_threshold', 5);

        $products = Product::query()
            ->when($filter === 'out', fn ($q) => $q->where('stock', '<=', 0))
            ->when($filter === 'low', fn ($q) => $q->where('stock', '>', 0)->where('stock', '<=', $threshold))
            ->when($request->query('sort') === 'stock', fn ($q) => $q->orderBy('stock'))
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => ProductResource::collection($products),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'total' => $products->total(),
                'low_stock_threshold' => $threshold,
                'low_stock_count' => Product::query()->without('images')->where('stock', '>', 0)->where('stock', '<=', $threshold)->count(),
                'out_of_stock_count' => Product::query()->without('images')->where('stock', '<=', 0)->count(),
            ],
        ]);
    }

    public function store(Request $request, StockService $stock): JsonResponse
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

        $initialStock = (int) ($validated['stock'] ?? 0);
        $validated['stock'] = 0;

        $product = DB::transaction(function () use ($validated, $initialStock, $stock, $request): Product {
            $product = Product::query()->create($validated);

            if ($initialStock > 0) {
                $stock->adjust($product, $initialStock, StockMovementReason::Initial, $request->user(), 'Stock initial');
            }

            return $product;
        });

        return response()->json([
            'data' => ProductResource::make($product->fresh()),
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

        // 'stock' volontairement absent : il ne change que via adjustStock().
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('products', 'slug')->ignore($product->id)],
            'description' => ['nullable', 'string'],
            'name_en' => ['nullable', 'string', 'max:255'],
            'description_en' => ['nullable', 'string'],
            'image_link' => ['nullable', 'url:http,https', 'max:2048'],
            'price' => ['sometimes', 'integer', 'min:0'],
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

    public function adjustStock(Request $request, Product $product, StockService $stock): JsonResponse
    {
        $this->authorize('update', $product);

        $data = $request->validate([
            'reason' => ['required', Rule::in(['restock', 'damage', 'inventory', 'adjustment'])],
            'quantity' => ['required', 'integer'],
            'note' => ['nullable', 'string', 'max:500', 'required_if:reason,adjustment'],
        ]);

        $reason = StockMovementReason::from($data['reason']);
        $qty = (int) $data['quantity'];

        $invalid = match ($reason) {
            StockMovementReason::Restock, StockMovementReason::Damage => $qty < 1,
            StockMovementReason::Inventory => $qty < 0,
            StockMovementReason::Adjustment => $qty === 0,
            default => true,
        };

        if ($invalid) {
            throw ValidationException::withMessages(['quantity' => 'Quantité invalide pour ce motif.']);
        }

        $admin = $request->user();
        $note = $data['note'] ?? null;

        $movement = match ($reason) {
            StockMovementReason::Restock => $stock->adjust($product, $qty, $reason, $admin, $note),
            StockMovementReason::Damage => $stock->adjust($product, -$qty, $reason, $admin, $note),
            StockMovementReason::Adjustment => $stock->adjust($product, $qty, $reason, $admin, $note),
            StockMovementReason::Inventory => $stock->setTo($product, $qty, $reason, $admin, $note),
        };

        return response()->json([
            'data' => ProductResource::make($product->fresh()),
            'movement' => [
                'id' => $movement->id,
                'quantity_change' => $movement->quantity_change,
                'stock_after' => $movement->stock_after,
            ],
        ]);
    }

    public function stockMovements(Product $product): JsonResponse
    {
        $this->authorize('view', $product);

        $movements = $product->stockMovements()
            ->with(['user:id,name', 'order:id,payment_transaction_id'])
            ->paginate(30);

        return response()->json([
            'data' => $movements->getCollection()->map(fn ($m) => [
                'id' => $m->id,
                'reason' => $m->reason->value,
                'quantity_change' => $m->quantity_change,
                'stock_after' => $m->stock_after,
                'note' => $m->note,
                'admin' => $m->user?->name,
                'order_id' => $m->order_id,
                'order_ref' => $m->order?->payment_transaction_id,
                'created_at' => $m->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $movements->currentPage(),
                'last_page' => $movements->lastPage(),
                'total' => $movements->total(),
            ],
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

    public function addGalleryImage(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        abort_if($product->images()->count() >= 8, 422, 'Maximum 8 images supplementaires.');

        $path = $request->file('image')->store('products', 'public');
        $product->images()->create([
            'path' => $path,
            'position' => (int) $product->images()->max('position') + 1,
        ]);

        return response()->json(['data' => ProductResource::make($product->fresh())]);
    }

    public function removeGalleryImage(Product $product, \App\Models\ProductImage $image): JsonResponse
    {
        $this->authorize('update', $product);

        abort_unless($image->product_id === $product->id, 404);

        if ($image->path) {
            Storage::disk('public')->delete($image->path);
        }

        $image->delete();

        return response()->json(['data' => ProductResource::make($product->fresh())]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->authorize('delete', $product);

        // Supprimer un produit déjà commandé casserait l'historique des commandes.
        if ($product->orderItems()->exists()) {
            return response()->json([
                'message' => 'Ce produit figure dans des commandes : masque-le plutôt que de le supprimer.',
            ], 422);
        }

        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        foreach ($product->images as $image) {
            if ($image->path) {
                Storage::disk('public')->delete($image->path);
            }
        }

        $product->delete();

        return response()->json(null, 204);
    }
}