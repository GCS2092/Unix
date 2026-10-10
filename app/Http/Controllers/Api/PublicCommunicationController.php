<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CommunicationSettings;
use Illuminate\Http\JsonResponse;

/** Infos publiques pour la page de suivi : bandeau d'annonce et contacts de support. */
class PublicCommunicationController extends Controller
{
    public function show(CommunicationSettings $settings): JsonResponse
    {
        return response()->json(['data' => $settings->publicView()]);
    }
}