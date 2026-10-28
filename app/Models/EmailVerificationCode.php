<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailVerificationCode extends Model
{
    public const CODE_MINUTES = 15;
    public const LINK_HOURS = 24;
    public const MAX_ATTEMPTS = 5;

    protected $fillable = ['user_id', 'code_hash', 'code_expires_at', 'attempts', 'token_hash', 'token_expires_at'];

    protected function casts(): array
    {
        return [
            'code_expires_at' => 'datetime',
            'token_expires_at' => 'datetime',
            'attempts' => 'integer',
        ];
    }

    /** Le code est hache avec la cle de l'application : une fuite de la base ne donne pas les codes. */
    public static function hashCode(int $userId, string $code): string
    {
        return hash_hmac('sha256', $userId.'|'.$code, (string) config('app.key'));
    }

    /**
     * Genere un nouveau code (6 chiffres) et un jeton de lien ; remplace les precedents.
     *
     * @return array{code: string, token: string}
     */
    public static function issue(User $user): array
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $token = bin2hex(random_bytes(20));

        static::query()->updateOrCreate(['user_id' => $user->id], [
            'code_hash' => static::hashCode($user->id, $code),
            'code_expires_at' => now()->addMinutes(self::CODE_MINUTES),
            'attempts' => 0,
            'token_hash' => hash('sha256', $token),
            'token_expires_at' => now()->addHours(self::LINK_HOURS),
        ]);

        return ['code' => $code, 'token' => $token];
    }
}