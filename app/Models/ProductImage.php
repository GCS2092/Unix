<?php

namespace App\Models;

use App\Support\ImageProcessor;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class ProductImage extends Model
{
    protected $fillable = ['product_id', 'path', 'link', 'position', 'disk'];

    protected static function booted(): void
    {
        static::deleting(function (ProductImage $image): void {
            ImageProcessor::delete($image->path, $image->disk ?: 'public');
        });
    }

    public function url(): ?string
    {
        if ($this->path) {
            return Storage::disk($this->disk ?: 'public')->url($this->path);
        }

        return $this->link ?: null;
    }

    /** Miniature pour les listes ; repli sur l'image complete. */
    public function thumbUrl(): ?string
    {
        if ($this->path && ($t = ImageProcessor::thumbPath($this->path))) {
            return Storage::disk($this->disk ?: 'public')->url($t);
        }

        return $this->url();
    }
}