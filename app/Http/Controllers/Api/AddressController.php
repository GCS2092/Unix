<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddressController extends Controller
{
    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'label' => ['nullable', 'string', 'max:60'],
            'recipient_name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:30'],
            'city' => ['required', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'address' => ['required', 'string', 'max:255'],
            'landmark' => ['nullable', 'string', 'max:255'],
            'is_default' => ['sometimes', 'boolean'],
        ];
    }

    private function owned(Request $request, Address $address): void
    {
        abort_unless($address->user_id === $request->user()->id, 404);
    }

    public function index(Request $request): JsonResponse
    {
        $rows = Address::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $uid = $request->user()->id;

        $isDefault = ! Address::query()->where('user_id', $uid)->exists()
            || (bool) ($data['is_default'] ?? false);

        if ($isDefault) {
            Address::query()->where('user_id', $uid)->update(['is_default' => false]);
        }

        $address = Address::query()->create(array_merge($data, [
            'user_id' => $uid,
            'is_default' => $isDefault,
        ]));

        return response()->json(['data' => $address], 201);
    }

    public function update(Request $request, Address $address): JsonResponse
    {
        $this->owned($request, $address);
        $data = $request->validate($this->rules());

        if ((bool) ($data['is_default'] ?? false)) {
            Address::query()->where('user_id', $address->user_id)->update(['is_default' => false]);
        } else {
            unset($data['is_default']);
        }

        $address->update($data);

        return response()->json(['data' => $address->fresh()]);
    }

    public function destroy(Request $request, Address $address): JsonResponse
    {
        $this->owned($request, $address);
        $wasDefault = $address->is_default;
        $uid = $address->user_id;
        $address->delete();

        if ($wasDefault) {
            Address::query()->where('user_id', $uid)->orderBy('id')->first()?->update(['is_default' => true]);
        }

        return response()->json(['message' => 'ok']);
    }
}