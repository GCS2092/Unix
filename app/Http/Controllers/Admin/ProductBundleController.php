<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductBundleController extends Controller
{
    public function show(Product $product): JsonResponse
    {
        $this->authorize('view', $product);

        return response()->json(['data' => $this->payload($product)]);
    }

    public function sync(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        if ($product->kind !== 'bundle') {
            throw ValidationException::withMessages(['components' => "Ce produit n'est pas un pack."]);
        }

        $data = $request->validate([
            'components' => ['present', 'array', 'max:30'],
            'components.*.id' => [
                'required', 'integer', 'distinct',
                Rule::notIn([$product->id]),
                // pas de pack dans un pack
                Rule::exists('products', 'id')->where(fn ($q) => $q->where('kind', '!=', 'bundle')),
            ],
            'components.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);

        $payload = [];
        foreach (array_values($data['components']) as $i => $row) {
            $payload[(int) $row['id']] = ['quantity' => (int) $row['quantity'], 'position' => $i];
        }

        DB::transaction(fn () => $product->components()->sync($payload));

        return response()->json(['data' => $this->payload($product->refresh())]);
    }

    /** @return array<string, mixed> */
    private function payload(Product $product): array
    {
        return [
            'components' => $product->components()->get()->map(fn (Product $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'price' => $c->price,
                'cost_price' => $c->cost_price,
                'stock' => (int) $c->stock,
                'kind' => $c->kind,
                'is_published' => $c->is_published,
                'quantity' => (int) $c->pivot->quantity,
            ])->values()->all(),
            'pack_stock' => $product->availableStock(),
        ];
    }
}