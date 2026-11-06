<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\CommunicationSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommunicationSettingsController extends Controller
{
    public function show(Request $request, CommunicationSettings $settings): JsonResponse
    {
        $extra = $request->user()?->hasAdminScope('super')
            ? ['admin_accounts' => \App\Models\User::query()->where('is_admin', true)->whereNotNull('email')->orderBy('name')->get(['id', 'name', 'email'])]
            : [];

        return response()->json(['data' => $settings->all() + $extra]);
    }

    public function update(Request $request, CommunicationSettings $settings, ActivityLogger $activity): JsonResponse
    {
        $emailList = function (string $attribute, mixed $value, \Closure $fail): void {
            foreach (preg_split('/[,;\s]+/', (string) $value, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $e) {
                if (! filter_var($e, FILTER_VALIDATE_EMAIL)) {
                    $fail("Adresse e-mail invalide : $e");
                }
            }
        };

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
            'send_admin_alerts' => ['sometimes', 'boolean'],
            'send_admin_alert_paid' => ['sometimes', 'boolean'],
            'send_admin_alert_stock' => ['sometimes', 'boolean'],
            'admin_alert_email' => ['sometimes', 'nullable', 'string', 'max:500', $emailList],
            'admin_alert_paid_to' => ['sometimes', 'nullable', 'string', 'max:500', $emailList],
            'admin_alert_stock_to' => ['sometimes', 'nullable', 'string', 'max:500', $emailList],
            'pay_wave' => ['sometimes', 'nullable', 'string', 'max:200'],
            'pay_orange_money' => ['sometimes', 'nullable', 'string', 'max:200'],
            'pay_free_money' => ['sometimes', 'nullable', 'string', 'max:200'],
            'pay_transfer' => ['sometimes', 'nullable', 'string', 'max:300'],
            'pay_note_fr' => ['sometimes', 'nullable', 'string', 'max:500'],
            'pay_note_en' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        // Les destinataires des alertes sont reserves au super-admin : ignores pour les autres
        if (! $request->user()?->hasAdminScope('super')) {
            $data = \Illuminate\Support\Arr::except($data, ['send_admin_alerts', 'send_admin_alert_paid', 'send_admin_alert_stock', 'admin_alert_email', 'admin_alert_paid_to', 'admin_alert_stock_to']);
        }

        $before = $settings->all();
        $settings->set($data);
        $after = $settings->all();

        $activity->log($request->user(), 'settings.communications_updated', null, ['before' => $before, 'after' => $after]);

        return response()->json(['data' => $after]);
    }
}