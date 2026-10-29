<?php

namespace App\Support\Export\Definitions;

use App\Models\Faq;
use App\Support\Export\ExportDefinition;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class FaqExport extends ExportDefinition
{
    public function __construct(private readonly string $space)
    {
    }

    public function key(): string { return 'faqs-'.$this->space; }
    public function label(): string { return $this->space === 'shop' ? 'FAQ boutique' : 'FAQ formation'; }
    public function scope(): string { return $this->space; }

    public function query(Request $request): Builder
    {
        return Faq::query()->where('space', $this->space);
    }

    public function columns(): array
    {
        return [
            'question' => fn (Faq $f) => $f->question_fr,
            'reponse' => fn (Faq $f) => $f->answer_fr,
            'categorie' => fn (Faq $f) => $f->category_fr,
            'question_en' => fn (Faq $f) => $f->question_en,
            'reponse_en' => fn (Faq $f) => $f->answer_en,
            'categorie_en' => fn (Faq $f) => $f->category_en,
            'position' => fn (Faq $f) => (int) $f->position,
            'publie' => fn (Faq $f) => $f->is_published ? 'oui' : 'non',
            'id' => fn (Faq $f) => $f->id,
        ];
    }
}