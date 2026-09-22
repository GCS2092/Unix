<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OrderPaymentService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CinetPayWebhookController extends Controller
{
    public function handle(Request $request, OrderPaymentService $payments): Response
    {
        $payments->handleCinetPayNotification($request->all());

        return response('OK', Response::HTTP_OK);
    }
}
