<?php

namespace App\Http\Requests\LiveKit;

use Illuminate\Foundation\Http\FormRequest;

class LiveKitTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'course_id' => ['required_without:room', 'integer', 'exists:courses,id'],
            'room' => ['required_without:course_id', 'string', 'max:255'],
            'identity' => ['sometimes', 'string', 'max:255'],
        ];
    }
}
