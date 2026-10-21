<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FaqController extends Controller
{
    /** Le parametre "space" vient du ->defaults() de chaque route (shop ou formation). */
    private function scoped(string $space)
    {
        return Faq::query()->where('space', $space);
    }

    private function rules(bool $partial): array
    {
        $req = $partial ? ['sometimes', 'required'] : ['required'];

        return [
            'question_fr' => array_merge($req, ['string', 'min:3', 'max:255']),
            'answer_fr' => array_merge($req, ['string', 'min:3', 'max:5000']),
            'question_en' => ['nullable', 'string', 'max:255'],
            'answer_en' => ['nullable', 'string', 'max:5000'],
            'category_fr' => ['nullable', 'string', 'max:80'],
            'category_en' => ['nullable', 'string', 'max:80'],
            'is_published' => ['sometimes', 'boolean'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'course_id' => ['nullable', 'integer', 'exists:courses,id'],
        ];
    }

    public function index(string $space): JsonResponse
    {
        return response()->json(['data' => $this->scoped($space)->orderBy('position')->orderBy('id')->get()]);
    }

    public function store(Request $request, string $space): JsonResponse
    {
        $data = $request->validate($this->rules(false));
        $data['space'] = $space;
        // Boutique : rattachement a un produit ; formation : a un cours
        if ($space === 'shop') {
            $data['course_id'] = null;
        } else {
            $data['product_id'] = null;
        }
        $data['position'] = ((int) $this->scoped($space)->max('position')) + 1;

        return response()->json(['data' => Faq::query()->create($data)], 201);
    }

    public function update(Request $request, string $space, int $id): JsonResponse
    {
        $faq = $this->scoped($space)->findOrFail($id);
        $data = $request->validate($this->rules(true));
        if ($space === 'shop') {
            unset($data['course_id']);
        } else {
            unset($data['product_id']);
        }
        $faq->update($data);

        return response()->json(['data' => $faq->fresh()]);
    }

    public function destroy(string $space, int $id): JsonResponse
    {
        $this->scoped($space)->findOrFail($id)->delete();

        return response()->json(['data' => ['id' => $id]]);
    }

    /** Recoit la liste complete des ids de CET espace dans le nouvel ordre. */
    public function reorder(Request $request, string $space): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', Rule::exists('faqs', 'id')->where('space', $space)],
        ]);

        DB::transaction(function () use ($data, $space): void {
            foreach (array_values($data['ids']) as $i => $id) {
                $this->scoped($space)->whereKey($id)->update(['position' => $i + 1]);
            }
        });

        return response()->json(['data' => ['count' => count($data['ids'])]]);
    }
}