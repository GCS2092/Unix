<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class ProductImage extends Model
{
    protected $fillable = ['product_id', 'path', 'link', 'position'];

    public function url(): ?string
    {
        if ($this->path) {
            return Storage::disk('public')->url($this->path);
        }

        return $this->link ?: null;
    }
}