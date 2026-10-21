<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Faq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FaqController extends Controller
{
    /** Liste publique d'un espace (?space=shop|formation) : questions publiees, dans l'ordre admin. */
    public function index(Request $request): JsonResponse
    {
        $space = $request->query('space') === 'formation' ? 'formation' : 'shop';

        $rows = Faq::query()
            ->where('space', $space)
            ->where('is_published', true)
            ->orderBy('position')
            ->orderBy('id')
            ->get(['id', 'space', 'category_fr', 'category_en', 'question_fr', 'answer_fr', 'question_en', 'answer_en', 'position', 'is_published']);

        return response()->json(['data' => $rows]);
    }
}