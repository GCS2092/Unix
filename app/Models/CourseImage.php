<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourseImage extends Model
{
    protected $fillable = ['course_id', 'path', 'position'];

    public function url(): string
    {
        return rtrim((string) config('app.url'), '/').'/api/v1/catalog/courses/media/'.rawurlencode(basename((string) $this->path));
    }
}