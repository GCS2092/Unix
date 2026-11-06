<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductAccessoryController extends Controller
{
    public function show(Product $product): JsonResponse
    {
        $this->authorize('view', $product);

        return response()->json(['data' => $this->payload($product)]);
    }

    public function sync(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        $data = $request->validate([
            'accessories' => ['present', 'array', 'max:100'],
            'accessories.*.id' => ['required', 'integer', 'distinct', 'exists:products,id', Rule::notIn([$product->id])],
            'accessories.*.is_required' => ['sometimes', 'boolean'],
        ]);

        $payload = [];
        foreach (array_values($data['accessories']) as $i => $row) {
            $payload[(int) $row['id']] = [
                'is_required' => (bool) ($row['is_required'] ?? false),
                'position' => $i,
            ];
        }

        DB::transaction(fn () => $product->accessories()->sync($payload));

        return response()->json(['data' => $this->payload($product->refresh())]);
    }

    /** @return array<int, array<string, mixed>> */
    private function payload(Product $product): array
    {
        return $product->accessories()->get()->map(fn (Product $a) => [
            'id' => $a->id,
            'name' => $a->name,
            'slug' => $a->slug,
            'price' => $a->price,
            'stock' => $a->stock,
            'kind' => $a->kind,
            'is_published' => $a->is_published,
            'is_required' => (bool) $a->pivot->is_required,
        ])->values()->all();
    }
}