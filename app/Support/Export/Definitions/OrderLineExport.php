<?php

namespace App\Support\Export\Definitions;

use App\Models\Course;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Support\Export\ExportDefinition;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class OrderLineExport extends ExportDefinition
{
    public function key(): string { return 'order-lines'; }
    public function label(): string { return 'Lignes de commande'; }
    public function scope(): string { return 'shop'; }
    public function ability(): ?array { return ['manage', Order::class]; }

    public function query(Request $request): Builder
    {
        return OrderItem::query()
            ->with(['order:id,public_ref,currency,status,created_at', 'itemable'])
            ->when($request->filled('from'), fn ($q) => $q->whereHas('order', fn ($o) => $o->where('created_at', '>=', Carbon::parse((string) $request->query('from'))->startOfDay())))
            ->when($request->filled('to'), fn ($q) => $q->whereHas('order', fn ($o) => $o->where('created_at', '<=', Carbon::parse((string) $request->query('to'))->endOfDay())))
            ->when($request->filled('status'), fn ($q) => $q->whereHas('order', fn ($o) => $o->where('status', (string) $request->query('status'))));
    }

    public function columns(): array
    {
        return [
            'commande_id' => fn (OrderItem $i) => $i->order_id,
            'reference' => fn (OrderItem $i) => $i->order?->public_ref,
            'date' => fn (OrderItem $i) => $i->order?->created_at,
            'statut' => fn (OrderItem $i) => $i->order?->status,
            'type' => fn (OrderItem $i) => $i->itemable instanceof Product ? 'produit' : ($i->itemable instanceof Course ? 'formation' : 'supprime'),
            'article' => fn (OrderItem $i) => $i->itemable?->name ?? $i->itemable?->title,
            'article_id' => fn (OrderItem $i) => $i->itemable_id,
            'quantite' => fn (OrderItem $i) => (int) $i->quantity,
            'prix_unitaire' => fn (OrderItem $i) => (int) $i->unit_price,
            'total_ligne' => fn (OrderItem $i) => (int) $i->line_total,
            'devise' => fn (OrderItem $i) => $i->order?->currency,
        ];
    }
}