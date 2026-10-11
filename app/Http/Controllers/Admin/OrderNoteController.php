<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\OrderNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderNoteController extends Controller
{
    /** Chronologie complete : creation, etapes de livraison, notes internes, actions de l'equipe. */
    public function timeline(Order $order): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $logs = ActivityLog::query()->with('user:id,name')
            ->where('subject_type', (new Order)->getMorphClass())
            ->where('subject_id', $order->id)
            ->get()
            ->map(fn (ActivityLog $l) => [
                'type' => 'action', 'id' => $l->id, 'label' => $l->action, 'author' => $l->user?->name,
                'meta' => $l->metadata, 'at' => $l->created_at?->toIso8601String(),
            ]);

        $steps = $order->events->map(fn ($e) => [
            'type' => 'step', 'label' => $e->step, 'at' => $e->created_at?->toIso8601String(),
        ]);

        $notes = $order->notes()->with('author:id,name')->get()->map(fn (OrderNote $n) => [
            'type' => 'note', 'id' => $n->id, 'label' => $n->body, 'author' => $n->author?->name,
            'user_id' => $n->user_id, 'at' => $n->created_at?->toIso8601String(),
        ]);

        $all = collect([['type' => 'created', 'label' => 'created', 'at' => $order->created_at?->toIso8601String()]])
            ->concat($steps)->concat($notes)->concat($logs)
            ->sortByDesc('at')->values();

        return response()->json(['data' => $all]);
    }

    public function store(Request $request, Order $order): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);
        $note = $order->notes()->create(['user_id' => $request->user()->id, 'body' => trim($data['body'])]);

        return response()->json(['data' => [
            'type' => 'note', 'id' => $note->id, 'label' => $note->body,
            'author' => $request->user()->name, 'user_id' => $note->user_id,
            'at' => $note->created_at?->toIso8601String(),
        ]], 201);
    }

    public function destroy(Request $request, Order $order, OrderNote $note): JsonResponse
    {
        $this->authorize('manage', Order::class);
        abort_unless($note->order_id === $order->id, 404);

        $me = $request->user();
        abort_unless($note->user_id === $me->id || $me->hasAdminScope('super'), 403, 'Seul l\'auteur peut supprimer cette note.');

        $note->delete();

        return response()->json(null, 204);
    }
}