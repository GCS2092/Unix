<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

final class MediaDisk
{
    /** Disque des images envoyees depuis l'admin : le disque par defaut (R2 quand ses cles sont presentes), sinon "public". */
    public static function name(): string
    {
        $default = (string) config('filesystems.default', 'public');

        return in_array($default, ['local', ''], true) ? 'public' : $default;
    }

    public static function disk(): Filesystem
    {
        return Storage::disk(self::name());
    }
}