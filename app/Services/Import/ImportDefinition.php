<?php

namespace App\Services\Import;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Decrit une ressource importable. Meta d'un champ :
 *  label, column (en-tete du modele), help, type (string|text|int|bool|enum|slug|id),
 *  aliases[], required (pour creer), key (sert a retrouver l'existant), virtual (non enregistre),
 *  max, min, values[] (enum), separator (slug).
 */
abstract class ImportDefinition
{
    abstract public function key(): string;

    abstract public function label(): string;

    /** shop | formation */
    abstract public function scope(): string;

    /** @return array<string, array<string, mixed>> */
    abstract public function fields(): array;

    /** Retrouve l'enregistrement existant d'apres les valeurs lues. */
    abstract public function find(array $d): ?Model;

    /** Cree l'enregistrement (applique les valeurs par defaut). */
    abstract public function create(array $attrs, ?User $admin): Model;

    /** Champs jamais modifies sur un enregistrement existant. */
    public function immutable(): array
    {
        return [];
    }

    /** Ligne d'exemple du modele, par cle de champ. */
    public function example(): array
    {
        return [];
    }

    /**
     * Derniere chance d'ajuster les attributs (relations...). $warn(champ, message) signale un avertissement.
     *
     * @param  \Closure(string,string):void  $warn
     */
    public function resolve(array $values, array $attrs, bool $creating, \Closure $warn): array
    {
        return $attrs;
    }
}