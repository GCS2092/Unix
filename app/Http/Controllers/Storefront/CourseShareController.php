<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Support\PlainText;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CourseShareController extends Controller
{
    public function show(Request $request, Course $course): Response
    {
        abort_unless($course->is_published, 404);

        $lang = (string) $request->query('lang', '');
        app()->setLocale(in_array($lang, ['fr', 'en'], true) ? $lang : 'fr');

        $name = (string) $course->localized('title');
        $target = rtrim((string) config('frontend.url'), '/').'/formations/'.$course->slug;
        $price = (int) $course->price > 0 ? number_format((int) $course->price, 0, ',', ' ').' FCFA' : '';
        $text = PlainText::from($course->localized('description'));
        $description = trim($price !== '' && $text !== '' ? $price.' - '.$text : $price.$text);
        if ($description === '') {
            $description = $name;
        }

        $image = null;
        if ($course->cover_image) {
            $image = rtrim((string) config('app.url'), '/').'/api/v1/catalog/courses/media/'.rawurlencode(basename((string) $course->cover_image));
        } elseif ($first = $course->images->first()) {
            $image = $first->url();
        }

        return response()->view('share.course', [
            'name' => $name,
            'description' => $description,
            'image' => $image,
            'target' => $target,
            'shareUrl' => $request->url(),
        ]);
    }
}