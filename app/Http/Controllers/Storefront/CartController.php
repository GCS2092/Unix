<?php

namespace App\Http\Controllers\Storefront;

use App\Enums\CartItemType;
use App\Http\Controllers\Controller;
use App\Http\Resources\CartResource;
use App\Services\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CartController extends Controller
{
    public function show(CartService $cart): JsonResponse
    {
        return response()->json([
            'data' => CartResource::make([
                'items' => $cart->detailedItems(),
                'total' => $cart->total(),
            ]),
        ]);
    }

    public function add(Request $request, CartService $cart): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::enum(CartItemType::class)],
            'id' => ['required', 'integer', 'min:1'],
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:99'],
        ]);

        try {
            $cart->add(
                $validated['type'],
                (int) $validated['id'],
                (int) ($validated['quantity'] ?? 1),
                $request->user(),
            );
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return $this->show($cart);
    }

    public function update(Request $request, CartService $cart, string $type, int $id): JsonResponse
    {
        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:0', 'max:99'],
        ]);

        $cart->update($type, $id, (int) $validated['quantity']);

        return $this->show($cart);
    }

    public function remove(CartService $cart, string $type, int $id): JsonResponse
    {
        $cart->remove($type, $id);

        return $this->show($cart);
    }
}
