<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use libphonenumber\NumberParseException;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\PhoneNumberUtil;

class PhoneNumber implements ValidationRule
{
    /** Region utilisee quand le numero n'a pas d'indicatif (+...). */
    public const DEFAULT_REGION = 'SN';

    /** Numero valide -> format E.164 (+221771234567), sinon null. */
    public static function normalize(string $value): ?string
    {
        $v = trim($value);

        if ($v === '' || strlen($v) > 30) {
            return null;
        }

        if (str_starts_with($v, '00')) {
            $v = '+'.substr($v, 2);
        }

        $util = PhoneNumberUtil::getInstance();

        try {
            $number = $util->parse($v, self::DEFAULT_REGION);
        } catch (NumberParseException) {
            return null;
        }

        return $util->isValidNumber($number) ? $util->format($number, PhoneNumberFormat::E164) : null;
    }

    public static function isValid(string $value): bool
    {
        return self::normalize($value) !== null;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! self::isValid($value)) {
            $fail(app()->getLocale() === 'en'
                ? 'The :attribute is not a valid phone number for the selected country.'
                : 'Le champ :attribute n\'est pas un numéro valide pour le pays sélectionné.');
        }
    }
}