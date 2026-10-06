<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Notifications\LiveInvitationNotification;
use App\Notifications\LiveSessionNotification;
use App\Notifications\LiveStartedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /** @return array<int, class-string> */
    private function types(): array
    {
        return [
            LiveInvitationNotification::class,
            LiveStartedNotification::class,
            LiveSessionNotification::class,
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $items = $user->notifications()
            ->whereIn('type', $this->types())
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'read_at' => $n->read_at,
                'created_at' => $n->created_at,
                'data' => $n->data,
            ])
            ->values();

        $unread = $user->unreadNotifications()
            ->whereIn('type', $this->types())
            ->count();

        return response()->json(['data' => $items, 'unread_count' => $unread]);
    }

    public function read(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->where('id', $id)->firstOrFail();
        $notification->markAsRead();

        return response()->json(['data' => ['id' => $notification->id]]);
    }

    public function readAll(Request $request): JsonResponse
    {
        $request->user()
            ->unreadNotifications()
            ->whereIn('type', $this->types())
            ->update(['read_at' => now()]);

        return response()->json(['data' => ['ok' => true]]);
    }
}