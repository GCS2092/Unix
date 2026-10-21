<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Faq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FaqController extends Controller
{
    /**
     * Liste publique d'un espace (?space=shop|formation).
     * Sans cible : questions generales seulement.
     * Avec ?product_id= (boutique) ou ?course_id= (formation) : generales + celles rattachees a cet element.
     */
    public function index(Request $request): JsonResponse
    {
        $space = $request->query('space') === 'formation' ? 'formation' : 'shop';
        $productId = $space === 'shop' ? ($request->integer('product_id') ?: null) : null;
        $courseId = $space === 'formation' ? ($request->integer('course_id') ?: null) : null;

        $rows = Faq::query()
            ->where('space', $space)
            ->where('is_published', true)
            ->where(function ($q) use ($productId, $courseId): void {
                $q->where(fn ($g) => $g->whereNull('product_id')->whereNull('course_id'));
                if ($productId) {
                    $q->orWhere('product_id', $productId);
                }
                if ($courseId) {
                    $q->orWhere('course_id', $courseId);
                }
            })
            ->orderBy('position')
            ->orderBy('id')
            ->get(['id', 'space', 'category_fr', 'category_en', 'question_fr', 'answer_fr', 'question_en', 'answer_en', 'position', 'is_published', 'product_id', 'course_id']);

        return response()->json(['data' => $rows]);
    }
}