<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

final class MediaDisk
{
    /** Disque des images envoyees depuis l'admin : le disque par defaut, avec repli sur "public" si R2 n'est pas configure. */
    public static function name(): string
    {
        $default = (string) config('filesystems.default', 'public');

        if (in_array($default, ['local', ''], true)) {
            return 'public';
        }

        if ($default === 'r2') {
            foreach (['key', 'secret', 'bucket', 'endpoint'] as $k) {
                if (blank(config("filesystems.disks.r2.$k"))) {
                    return 'public';
                }
            }
        }

        return $default;
    }

    public static function disk(): Filesystem
    {
        return Storage::disk(self::name());
    }
}