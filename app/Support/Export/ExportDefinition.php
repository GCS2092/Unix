<?php

namespace App\Support\Export;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

abstract class ExportDefinition
{
    abstract public function key(): string;

    abstract public function label(): string;

    /** shop | formation */
    abstract public function scope(): string;

    /** [ability, class] verifie par Gate, ou null (le middleware de scope suffit). */
    public function ability(): ?array
    {
        return null;
    }

    /** Requete SANS orderBy (le streaming trie par id). */
    abstract public function query(Request $request): Builder;

    /** @return array<string, \Closure(\Illuminate\Database\Eloquent\Model): mixed> en-tete => extracteur */
    abstract public function columns(): array;

    public function filename(): string
    {
        return $this->key().'-'.now()->format('Y-m-d_His');
    }

    protected function dateRange(Builder $q, Request $r, string $column = 'created_at'): Builder
    {
        return $q
            ->when($r->filled('from'), fn ($w) => $w->where($column, '>=', Carbon::parse((string) $r->query('from'))->startOfDay()))
            ->when($r->filled('to'), fn ($w) => $w->where($column, '<=', Carbon::parse((string) $r->query('to'))->endOfDay()));
    }
}