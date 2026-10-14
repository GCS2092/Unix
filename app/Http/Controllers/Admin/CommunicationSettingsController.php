<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\CommunicationSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommunicationSettingsController extends Controller
{
    public function show(CommunicationSettings $settings): JsonResponse
    {
        return response()->json(['data' => $settings->all()]);
    }

    public function update(Request $request, CommunicationSettings $settings, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'shop_name' => ['sometimes', 'required', 'string', 'max:80'],
            'support_email' => ['sometimes', 'nullable', 'email', 'max:120'],
            'support_whatsapp' => ['sometimes', 'nullable', 'string', 'max:20', 'regex:/^\+?[0-9 ]{6,20}$/'],
            'pickup_place' => ['sometimes', 'nullable', 'string', 'max:200'],
            'pickup_hours' => ['sometimes', 'nullable', 'string', 'max:200'],
            'pickup_requirements' => ['sometimes', 'nullable', 'string', 'max:300'],
            'prep_days' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'message_fr' => ['sometimes', 'nullable', 'string', 'max:500'],
            'message_en' => ['sometimes', 'nullable', 'string', 'max:500'],
            'announcement_fr' => ['sometimes', 'nullable', 'string', 'max:200'],
            'announcement_en' => ['sometimes', 'nullable', 'string', 'max:200'],
            'default_warranty_months' => ['sometimes', 'integer', 'min:0', 'max:120'],
            'attach_invoice' => ['sometimes', 'boolean'],
            'send_stage_emails' => ['sometimes', 'boolean'],
            'invite_account_cta' => ['sometimes', 'boolean'],
            'pay_wave' => ['sometimes', 'nullable', 'string', 'max:200'],
            'pay_orange_money' => ['sometimes', 'nullable', 'string', 'max:200'],
            'pay_free_money' => ['sometimes', 'nullable', 'string', 'max:200'],
            'pay_transfer' => ['sometimes', 'nullable', 'string', 'max:300'],
            'pay_note_fr' => ['sometimes', 'nullable', 'string', 'max:500'],
            'pay_note_en' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $before = $settings->all();
        $settings->set($data);
        $after = $settings->all();

        $activity->log($request->user(), 'settings.communications_updated', null, ['before' => $before, 'after' => $after]);

        return response()->json(['data' => $after]);
    }
}