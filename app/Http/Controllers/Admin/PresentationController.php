<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Presentation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PresentationController extends Controller
{
    public function show(string $space): JsonResponse
    {
        return response()->json(['data' => Presentation::forSpace($space)]);
    }

    public function update(Request $request, string $space): JsonResponse
    {
        $item = ['required', 'string', 'max:500'];
        $data = $request->validate([
            'published' => ['boolean'],
            'show_courses' => ['boolean'],
            'show_faq' => ['boolean'],
            'hero_title_fr' => ['nullable', 'string', 'max:120'],
            'hero_title_en' => ['nullable', 'string', 'max:120'],
            'hero_subtitle_fr' => ['nullable', 'string', 'max:300'],
            'hero_subtitle_en' => ['nullable', 'string', 'max:300'],
            'intro_fr' => ['nullable', 'string', 'max:2000'],
            'intro_en' => ['nullable', 'string', 'max:2000'],
            'location_name' => ['nullable', 'string', 'max:120'],
            'location_address_fr' => ['nullable', 'string', 'max:255'],
            'location_address_en' => ['nullable', 'string', 'max:255'],
            'location_hours_fr' => ['nullable', 'string', 'max:255'],
            'location_hours_en' => ['nullable', 'string', 'max:255'],
            'location_map_url' => ['nullable', 'url', 'max:500', 'regex:/^https?:\/\//i'],
            'contact_phone' => ['nullable', 'string', 'max:30'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'steps' => ['array', 'max:6'],
            'advantages' => ['array', 'max:8'],
            'steps.*.title_fr' => ['required', 'string', 'max:80'],
            'steps.*.title_en' => ['nullable', 'string', 'max:80'],
            'steps.*.text_fr' => $item,
            'steps.*.text_en' => ['nullable', 'string', 'max:500'],
            'advantages.*.title_fr' => ['required', 'string', 'max:80'],
            'advantages.*.title_en' => ['nullable', 'string', 'max:80'],
            'advantages.*.text_fr' => $item,
            'advantages.*.text_en' => ['nullable', 'string', 'max:500'],
        ]);

        Presentation::query()->updateOrCreate(['space' => $space], ['content' => $data]);

        return response()->json(['data' => Presentation::forSpace($space)]);
    }
}