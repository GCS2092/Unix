<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class PersonName implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $t = is_string($value) ? trim($value) : '';
        $letters = preg_match_all('/\p{L}/u', $t);

        if ($letters < 2 || ! preg_match("/^\p{L}[\p{L}\p{M}\s'’.\-]*$/u", $t)) {
            $fail(app()->getLocale() === 'en'
                ? 'The :attribute must contain letters only (2 minimum).'
                : 'Le champ :attribute doit contenir uniquement des lettres (2 minimum).');
        }
    }
}