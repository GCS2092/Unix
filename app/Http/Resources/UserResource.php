<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'is_admin' => $this->is_admin,
            'admin_scope' => $this->admin_scope ?: ($this->is_admin ? 'super' : null),
            'phone' => $this->phone,
            'is_student' => (bool) $this->is_student,
            'created_at' => $this->created_at,
        ];
    }
}
