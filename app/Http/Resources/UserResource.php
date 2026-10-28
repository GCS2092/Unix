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
            'gender' => $this->gender,
            'birth_date' => $this->birth_date ? substr((string) $this->birth_date, 0, 10) : null,
            'birth_place' => $this->birth_place,
            'birth_country' => $this->birth_country,
            'nationality' => $this->nationality,
            'country' => $this->country,
            'city' => $this->city,
            'address' => $this->address,
            'profession' => $this->profession,
            'email_verified' => $this->email_verified_at !== null,
            'created_at' => $this->created_at,
        ];
    }
}
