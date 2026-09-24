<?php

namespace App\Http\Resources;

use App\Models\Certificate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Certificate */
class CertificateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'file_path' => $this->file_path,
            'issued_at' => $this->issued_at,
            'download_url' => $this->when(
                $request->user() !== null,
                route('api.v1.certificates.download', $this->id),
            ),
        ];
    }
}
