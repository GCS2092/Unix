<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CommunicationSettings;
use App\Services\ShopSettings;
use Illuminate\Http\JsonResponse;

/** Infos publiques de la boutique : contact, retrait, horaires, reseaux, regles de commande. */
class PublicShopController extends Controller
{
    public function show(CommunicationSettings $comms, ShopSettings $shop): JsonResponse
    {
        $c = $comms->all();
        $s = $shop->all();

        return response()->json(['data' => [
            'shop_name' => (string) $c['shop_name'],
            'support_email' => (string) $c['support_email'],
            'support_whatsapp' => (string) $c['support_whatsapp'],
            'pickup_place' => (string) $c['pickup_place'],
            'pickup_hours' => (string) $c['pickup_hours'],
            'pickup_requirements' => (string) $c['pickup_requirements'],
            'legal_name' => (string) $s['legal_name'],
            'legal_address' => (string) $s['legal_address'],
            'legal_phone' => (string) $s['legal_phone'],
            'legal_email' => (string) $s['legal_email'],
            'opening_hours' => (string) $s['opening_hours'],
            'social_facebook' => (string) $s['social_facebook'],
            'social_instagram' => (string) $s['social_instagram'],
            'social_tiktok' => (string) $s['social_tiktok'],
            'terms_url' => (string) $s['terms_url'],
            'free_shipping_threshold' => (int) $s['free_shipping_threshold'],
            'min_order' => (int) $s['min_order'],
        ]]);
    }
}