<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Course;
use App\Models\EnrollmentRequest;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use App\Support\CountryCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class FormationSignupController extends Controller
{
    private const MIN_AGE = 16;
    private const MAX_AGE = 100;
    private const NAME_RE = '/^[\p{L}\p{M}][\p{L}\p{M}\s\'’.\-]*$/u';
    private const TWO_WORDS_RE = '/^\S+(\s+\S+)+$/u';
    private const PLACE_RE = '/^[\p{L}\p{M}0-9][\p{L}\p{M}0-9\s\'’.,()\/\-]*$/u';
    private const PHONE_RE = '/^\+[1-9]\d{7,14}$/';

    /** Cree le compte ET la demande d'acces au cours en une seule etape. */
    public function __invoke(Request $request): JsonResponse
    {
        $country = ['required', 'string', Rule::in(CountryCodes::CODES)];

        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:255', 'regex:'.self::NAME_RE, 'regex:'.self::TWO_WORDS_RE],
            'email' => ['required', app()->environment('production') ? 'email:rfc,dns' : 'email:rfc', 'max:255'],
            'phone' => ['required', 'string', 'regex:'.self::PHONE_RE],
            'password' => ['required', 'string', 'confirmed', Password::min(8)->letters()->numbers()],
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'message' => ['nullable', 'string', 'max:500'],
            'gender' => ['required', 'in:male,female'],
            'birth_date' => ['required', 'date', function (string $attr, mixed $value, \Closure $fail): void {
                try {
                    $d = Carbon::parse($value);
                } catch (\Throwable) {
                    $fail('Date de naissance invalide.');
                    return;
                }
                if ($d->isFuture()) {
                    $fail('Date de naissance invalide.');
                } elseif ($d->age < self::MIN_AGE) {
                    $fail('Vous devez avoir au moins '.self::MIN_AGE.' ans pour vous inscrire.');
                } elseif ($d->age > self::MAX_AGE) {
                    $fail('Date de naissance invalide.');
                }
            }],
            'birth_place' => ['required', 'string', 'min:2', 'max:120', 'regex:'.self::PLACE_RE],
            'birth_country' => $country,
            'nationality' => $country,
            'country' => $country,
            'city' => ['required', 'string', 'min:2', 'max:120', 'regex:'.self::PLACE_RE],
            'address' => ['nullable', 'string', 'min:5', 'max:255'],
            'profession' => ['nullable', 'string', 'max:120'],
        ], [
            'name.regex' => 'Indiquez votre prénom et votre nom (lettres, espaces, tirets et apostrophes uniquement).',
            'phone.regex' => 'Numéro de téléphone invalide (format international attendu, ex. +221771234567).',
            'birth_place.regex' => 'Lieu de naissance invalide.',
            'city.regex' => 'Ville invalide.',
            'birth_country.in' => 'Pays de naissance invalide.',
            'nationality.in' => 'Nationalité invalide.',
            'country.in' => 'Pays de résidence invalide.',
            'gender.in' => 'Sexe invalide.',
        ]);

        $email = Str::lower(trim($data['email']));

        if (User::query()->whereRaw('lower(email) = ?', [$email])->exists()) {
            throw ValidationException::withMessages([
                'email' => ['Un compte existe déjà avec cet e-mail. Cliquez sur « J\'ai déjà un compte » pour vous connecter.'],
            ]);
        }

        $course = Course::query()->findOrFail($data['course_id']);
        if (! $course->is_published) {
            abort(404);
        }

        $profile = Arr::only($data, [
            'gender', 'birth_date', 'birth_place', 'birth_country',
            'nationality', 'country', 'city', 'address', 'profession',
        ]);

        $user = DB::transaction(function () use ($data, $email, $course, $profile): User {
            $user = new User();
            $user->forceFill(array_merge($profile, [
                'name' => Str::squish($data['name']),
                'email' => $email,
                'phone' => trim($data['phone']),
                'password' => $data['password'],
            ]))->save();

            EnrollmentRequest::query()->create([
                'user_id' => $user->id,
                'course_id' => $course->id,
                'status' => 'pending',
                'message' => $data['message'] ?? null,
            ]);

            return $user;
        });

        try {
            $user->notify(new VerifyEmailNotification);
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'user' => UserResource::make($user),
            'token' => $user->createToken('api')->plainTextToken,
            'request_status' => 'pending',
        ], 201);
    }
}