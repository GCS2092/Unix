<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class PhoneNumber implements ValidationRule
{
    private const SN = '/^(70|75|76|77|78|33|30)\d{7}$/';

    public static function isValid(string $value): bool
    {
        $v = trim($value);

        if (! preg_match('/^\+?[0-9\s.\-()]{8,25}$/', $v)) {
            return false;
        }

        $digits = (string) preg_replace('/\D/', '', $v);
        $intl = str_starts_with($v, '+');

        if (! $intl && str_starts_with($digits, '00')) {
            $intl = true;
            $digits = substr($digits, 2);
        }

        if (str_starts_with($digits, '221') && ($intl || strlen($digits) === 12)) {
            return (bool) preg_match(self::SN, substr($digits, 3));
        }

        if ($intl) {
            return (bool) preg_match('/^[1-9]\d{7,14}$/', $digits);
        }

        return (bool) preg_match(self::SN, $digits);
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! self::isValid($value)) {
            $fail(app()->getLocale() === 'en'
                ? 'The :attribute is not a valid phone number. E.g. 77 123 45 67 or +33 6 12 34 56 78.'
                : 'Le champ :attribute n\'est pas un numéro valide. Ex. : 77 123 45 67 ou +33 6 12 34 56 78.');
        }
    }
}