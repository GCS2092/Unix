<?php

namespace App\Http\Requests;

use App\Rules\PersonName;
use App\Rules\PhoneNumber;
use App\Support\Countries;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('guest_email');

        if (is_string($email)) {
            $this->merge(['guest_email' => mb_strtolower(trim($email))]);
        }

        $phone = $this->input('phone');

        if (is_string($phone)) {
            $this->merge(['phone' => PhoneNumber::normalize($phone) ?? $phone]);
        }

        $country = $this->input('country');

        $this->merge(['country' => is_string($country) && trim($country) !== '' ? strtoupper(trim($country)) : 'SN']);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $needsAddress = Rule::requiredIf(fn (): bool => ($this->input('delivery_method') ?? 'delivery') === 'delivery');

        return [
            'guest_name' => $this->user() === null
                ? ['required', 'string', 'min:2', 'max:120', new PersonName]
                : ['nullable', 'string', 'max:255'],
            'guest_email' => [$this->user() === null ? 'required' : 'nullable', 'email:rfc', 'max:255'],
            'phone' => ['required', 'string', 'max:30', new PhoneNumber],
            'country' => ['required', Rule::in(Countries::CODES)],
            'delivery_method' => ['nullable', Rule::in(['delivery', 'pickup'])],
            'delivery_zone' => ['nullable', Rule::exists('shipping_zones', 'code')->where('is_active', true)->where('country', $this->input('country'))],
            'city' => ['nullable', $needsAddress, 'string', 'min:2', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', $needsAddress, 'string', 'min:5', 'max:255'],
            'landmark' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:1000'],
            'accept_terms' => ['accepted'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.required' => __('checkout.phone_required'),
            'accept_terms.accepted' => __('checkout.terms'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return __('checkout.attributes');
    }
}