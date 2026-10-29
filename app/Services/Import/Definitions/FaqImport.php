<?php

namespace App\Services\Import\Definitions;

use App\Models\Faq;
use App\Models\User;
use App\Services\Import\ImportDefinition;
use Illuminate\Database\Eloquent\Model;

class FaqImport extends ImportDefinition
{
    public function __construct(private readonly string $space)
    {
    }

    public function key(): string { return 'faqs-'.$this->space; }
    public function label(): string { return $this->space === 'shop' ? 'FAQ boutique' : 'FAQ formation'; }
    public function scope(): string { return $this->space; }

    public function fields(): array
    {
        return [
            'question_fr' => ['label' => 'Question', 'column' => 'question', 'type' => 'string', 'max' => 255, 'required' => true, 'key' => true,
                'help' => 'Question en français. Sert aussi à retrouver une entrée existante.',
                'aliases' => ['question', 'questions', 'question fr', 'intitule', 'titre']],
            'answer_fr' => ['label' => 'Réponse', 'column' => 'reponse', 'type' => 'text', 'required' => true,
                'help' => 'Réponse en français.',
                'aliases' => ['reponse', 'answer', 'reponse fr', 'texte', 'contenu']],
            'category_fr' => ['label' => 'Catégorie', 'column' => 'categorie', 'type' => 'string', 'max' => 80,
                'help' => 'Rubrique de regroupement.',
                'aliases' => ['categorie', 'category', 'rubrique', 'theme', 'categorie fr']],
            'question_en' => ['label' => 'Question (anglais)', 'column' => 'question_en', 'type' => 'string', 'max' => 255,
                'help' => 'Question en anglais.',
                'aliases' => ['question en', 'question anglais', 'english question']],
            'answer_en' => ['label' => 'Réponse (anglais)', 'column' => 'reponse_en', 'type' => 'text',
                'help' => 'Réponse en anglais.',
                'aliases' => ['reponse en', 'answer en', 'reponse anglais', 'english answer']],
            'category_en' => ['label' => 'Catégorie (anglais)', 'column' => 'categorie_en', 'type' => 'string', 'max' => 80,
                'help' => 'Rubrique en anglais.',
                'aliases' => ['categorie en', 'category en', 'english category']],
            'position' => ['label' => 'Position', 'column' => 'position', 'type' => 'int', 'max' => 2000000000,
                'help' => 'Ordre d\'affichage.',
                'aliases' => ['position', 'ordre', 'rang', 'order']],
            'is_published' => ['label' => 'Publié', 'column' => 'publie', 'type' => 'bool',
                'help' => 'oui ou non.',
                'aliases' => ['publie', 'published', 'visible', 'actif', 'statut', 'en ligne']],
            'id' => ['label' => 'ID', 'column' => 'id', 'type' => 'id', 'key' => true, 'virtual' => true,
                'help' => 'Identifiant interne (présent dans les exports).',
                'aliases' => ['id']],
        ];
    }

    public function example(): array
    {
        return ['question_fr' => 'Quels sont les délais de livraison ?', 'answer_fr' => 'Entre 24 et 72 heures selon la zone.', 'category_fr' => 'Livraison', 'is_published' => 'oui', 'position' => 1];
    }

    public function find(array $d): ?Model
    {
        $q = Faq::query()->where('space', $this->space);
        if (isset($d['id']) && ($m = (clone $q)->find($d['id']))) {
            return $m;
        }
        if (isset($d['question_fr'])) {
            return (clone $q)->whereRaw('LOWER(question_fr) = ?', [mb_strtolower($d['question_fr'])])->first();
        }

        return null;
    }

    public function create(array $attrs, ?User $admin): Model
    {
        return Faq::query()->create($attrs + [
            'space' => $this->space,
            'is_published' => true,
            'position' => (int) Faq::query()->where('space', $this->space)->max('position') + 1,
        ]);
    }
}