<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\ShopSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopSettingsController extends Controller
{
    public function show(ShopSettings $settings): JsonResponse
    {
        return response()->json(['data' => $settings->all()]);
    }

    public function update(Request $request, ShopSettings $settings, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'legal_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'legal_address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'legal_phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'legal_email' => ['sometimes', 'nullable', 'email', 'max:120'],
            'ninea' => ['sometimes', 'nullable', 'string', 'max:40'],
            'rccm' => ['sometimes', 'nullable', 'string', 'max:60'],
            'invoice_footer' => ['sometimes', 'nullable', 'string', 'max:300'],
            'free_shipping_threshold' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'min_order' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'reservation_minutes' => ['sometimes', 'integer', 'min:5', 'max:1440'],
            'mail_from_name' => ['sometimes', 'nullable', 'string', 'max:80'],
            'opening_hours' => ['sometimes', 'nullable', 'string', 'max:200'],
            'social_facebook' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'social_instagram' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'social_tiktok' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'terms_url' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
        ]);

        $before = $settings->all();
        $settings->set($data);
        $settings->apply();
        $after = $settings->all();

        $activity->log($request->user(), 'settings.shop_updated', null, ['before' => $before, 'after' => $after]);

        return response()->json(['data' => $after]);
    }
}