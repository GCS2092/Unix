<?php

namespace App\Support\Export\Definitions;

use App\Models\Course;
use App\Support\Export\ExportDefinition;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class CourseExport extends ExportDefinition
{
    public function key(): string { return 'courses'; }
    public function label(): string { return 'Formations'; }
    public function scope(): string { return 'formation'; }

    public function query(Request $request): Builder
    {
        $u = $request->user();
        $instructor = ($u->admin_scope ?? 'super') === 'instructor';

        return Course::query()->with('instructor:id,name')
            ->when($instructor, fn ($q) => $q->where('instructor_id', $u->id));
    }

    public function columns(): array
    {
        return [
            'titre' => fn (Course $c) => $c->title,
            'slug' => fn (Course $c) => $c->slug,
            'prix' => fn (Course $c) => (int) $c->price,
            'publie' => fn (Course $c) => $c->is_published ? 'oui' : 'non',
            'description' => fn (Course $c) => $c->description,
            'titre_en' => fn (Course $c) => $c->title_en,
            'description_en' => fn (Course $c) => $c->description_en,
            'objectifs' => fn (Course $c) => $c->objectives,
            'programme' => fn (Course $c) => $c->program,
            'public_cible' => fn (Course $c) => $c->audience,
            'prerequis' => fn (Course $c) => $c->prerequisites,
            'duree_secondes' => fn (Course $c) => $c->duration_seconds,
            'formateur' => fn (Course $c) => $c->instructor?->name,
            'id' => fn (Course $c) => $c->id,
            'cree_le' => fn (Course $c) => $c->created_at,
        ];
    }
}