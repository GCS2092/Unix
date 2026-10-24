<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /** Mots francais -> mots utilises dans les noms d'actions. */
    private const SYNONYMS = [
        'commande' => 'order', 'commandes' => 'order',
        'paiement' => 'payment', 'paiements' => 'payment',
        'produit' => 'product', 'produits' => 'product',
        'utilisateur' => 'user', 'utilisateurs' => 'user',
        'facture' => 'invoice', 'factures' => 'invoice',
        'certificat' => 'certificate', 'certificats' => 'certificate',
        'cours' => 'course', 'inscription' => 'enrollment',
        'categorie' => 'category', 'connexion' => 'login',
        'parametres' => 'settings', 'livraison' => 'shipping',
    ];

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $terms = array_slice(preg_split('/\s+/', $q, -1, PREG_SPLIT_NO_EMPTY) ?: [], 0, 6);

        $logs = ActivityLog::query()->with('user:id,name,email');

        foreach ($terms as $term) {
            $term = ltrim($term, '#');
            if ($term === '') {
                continue;
            }
            $variants = [$term];
            $key = mb_strtolower($term);
            if (isset(self::SYNONYMS[$key])) {
                $variants[] = self::SYNONYMS[$key];
            }

            $logs->where(function ($w) use ($variants) {
                foreach ($variants as $v) {
                    $like = '%'.addcslashes($v, '%_\\').'%';
                    $w->orWhere('action', 'like', $like)
                        ->orWhere('subject_type', 'like', $like)
                        ->orWhere('metadata', 'like', $like)
                        ->orWhereHas('user', fn ($u) => $u->where('name', 'like', $like)->orWhere('email', 'like', $like));
                    if (ctype_digit($v)) {
                        $w->orWhere('subject_id', (int) $v)->orWhere('id', (int) $v);
                    }
                }
            });
        }

        $logs = $logs->latest('id')->paginate(30);

        return response()->json([
            'data' => $logs->getCollection()->map(fn (ActivityLog $l) => [
                'id' => $l->id,
                'action' => $l->action,
                'user_name' => $l->user?->name,
                'user_email' => $l->user?->email,
                'subject_type' => $l->subject_type ? class_basename($l->subject_type) : null,
                'subject_id' => $l->subject_id,
                'metadata' => $l->metadata,
                'created_at' => $l->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
