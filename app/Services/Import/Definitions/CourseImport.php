<?php

namespace App\Services\Import\Definitions;

use App\Models\Course;
use App\Models\User;
use App\Services\Import\ImportDefinition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/** Memes regles que CourseController@store : slug genere, non publie, aucun formateur assigne. */
class CourseImport extends ImportDefinition
{
    public function key(): string { return 'courses'; }
    public function label(): string { return 'Formations'; }
    public function scope(): string { return 'formation'; }
    public function immutable(): array { return ['slug']; }

    public function fields(): array
    {
        $txt = fn (string $label, string $col, int $max, array $aliases, string $help) => [
            'label' => $label, 'column' => $col, 'type' => 'text', 'max' => $max, 'help' => $help, 'aliases' => $aliases,
        ];

        return [
            'title' => ['label' => 'Titre', 'column' => 'titre', 'type' => 'string', 'max' => 255, 'required' => true, 'key' => true,
                'help' => 'Titre de la formation. Sert aussi à retrouver une formation existante.',
                'aliases' => ['titre', 'title', 'nom', 'intitule', 'formation', 'cours', 'nom du cours', 'libelle']],
            'slug' => ['label' => 'Slug', 'column' => 'slug', 'type' => 'slug', 'max' => 255, 'key' => true,
                'help' => 'Identifiant unique dans les URL. Généré si absent. Non modifiable ensuite.',
                'aliases' => ['slug', 'reference', 'ref', 'code']],
            'price' => ['label' => 'Prix', 'column' => 'prix', 'type' => 'int', 'max' => 2000000000, 'required' => true,
                'help' => 'Prix, nombre entier (0 = gratuit).',
                'aliases' => ['prix', 'price', 'tarif', 'montant', 'cout']],
            'is_published' => ['label' => 'Publié', 'column' => 'publie', 'type' => 'bool',
                'help' => 'oui ou non. Vide = non (brouillon) à la création.',
                'aliases' => ['publie', 'published', 'visible', 'statut', 'actif', 'en ligne']],
            'description' => $txt('Description', 'description', 65000, ['description', 'desc', 'details', 'resume'], 'Description en français.'),
            'title_en' => ['label' => 'Titre (anglais)', 'column' => 'titre_en', 'type' => 'string', 'max' => 255,
                'help' => 'Titre en anglais.', 'aliases' => ['titre en', 'title en', 'english title', 'titre anglais']],
            'description_en' => $txt('Description (anglais)', 'description_en', 65000, ['description en', 'desc en', 'english description'], 'Description en anglais.'),
            'objectives' => $txt('Objectifs', 'objectifs', 10000, ['objectifs', 'objectives', 'objectif'], 'Objectifs pédagogiques.'),
            'objectives_en' => $txt('Objectifs (anglais)', 'objectifs_en', 10000, ['objectifs en', 'objectives en'], 'Objectifs en anglais.'),
            'program' => $txt('Programme', 'programme', 20000, ['programme', 'program', 'contenu', 'syllabus'], 'Programme détaillé.'),
            'program_en' => $txt('Programme (anglais)', 'programme_en', 20000, ['programme en', 'program en'], 'Programme en anglais.'),
            'audience' => $txt('Public cible', 'public_cible', 10000, ['public cible', 'public', 'audience', 'destinataires'], 'À qui s\'adresse la formation.'),
            'audience_en' => $txt('Public cible (anglais)', 'public_cible_en', 10000, ['public cible en', 'audience en'], 'Public cible en anglais.'),
            'prerequisites' => $txt('Prérequis', 'prerequis', 10000, ['prerequis', 'prerequisites', 'pre requis'], 'Prérequis.'),
            'prerequisites_en' => $txt('Prérequis (anglais)', 'prerequis_en', 10000, ['prerequis en', 'prerequisites en'], 'Prérequis en anglais.'),
            'duration_seconds' => ['label' => 'Durée (secondes)', 'column' => 'duree_secondes', 'type' => 'int', 'min' => 1, 'max' => 86400,
                'help' => 'Durée en SECONDES (3600 = 1 h), entre 1 et 86400.',
                'aliases' => ['duree secondes', 'duration seconds', 'duree en secondes']],
            'id' => ['label' => 'ID', 'column' => 'id', 'type' => 'id', 'key' => true, 'virtual' => true,
                'help' => 'Identifiant interne (présent dans les exports).', 'aliases' => ['id', 'identifiant']],
        ];
    }

    public function example(): array
    {
        return ['title' => 'Initiation à la couture', 'price' => 25000, 'is_published' => 'non', 'description' => 'Apprenez les bases.', 'duration_seconds' => 7200];
    }

    public function find(array $d): ?Model
    {
        if (isset($d['id']) && ($m = Course::query()->find($d['id']))) {
            return $m;
        }
        if (isset($d['slug']) && ($m = Course::query()->where('slug', $d['slug'])->first())) {
            return $m;
        }
        if (isset($d['title'])) {
            return Course::query()->whereRaw('LOWER(title) = ?', [mb_strtolower($d['title'])])->first();
        }

        return null;
    }

    public function create(array $attrs, ?User $admin): Model
    {
        $slug = $attrs['slug'] ?? (Str::slug(Str::limit($attrs['title'], 200, '')).'-'.Str::random(6));
        while (Course::query()->where('slug', $slug)->exists()) {
            $slug .= '-'.Str::lower(Str::random(3));
        }

        return Course::query()->create($attrs + ['slug' => $slug, 'is_published' => false]);
    }
}