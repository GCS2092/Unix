<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use Illuminate\Http\JsonResponse;

class CertificateVerifyController extends Controller
{
    public function show(string $code): JsonResponse
    {
        $code = strtoupper(trim($code));
        abort_unless(preg_match('/^[A-Z0-9-]{8,16}$/', $code) === 1, 404);

        $cert = Certificate::query()
            ->with(['enrollment.user:id,name', 'enrollment.course:id,title'])
            ->where('code', $code)
            ->first();

        abort_if($cert === null, 404);

        return response()->json(['data' => [
            'valid' => true,
            'code' => $cert->code,
            'holder' => $cert->enrollment?->user?->name,
            'course' => $cert->enrollment?->course?->title,
            'issued_at' => $cert->issued_at?->toIso8601String(),
        ]]);
    }
}