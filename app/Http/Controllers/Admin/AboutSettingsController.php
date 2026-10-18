<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AboutSettings;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AboutSettingsController extends Controller
{
    public function show(AboutSettings $about): JsonResponse
    {
        return response()->json(['data' => $about->all()]);
    }

    public function update(Request $request, AboutSettings $about, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'tagline_fr' => ['sometimes', 'nullable', 'string', 'max:160'],
            'tagline_en' => ['sometimes', 'nullable', 'string', 'max:160'],
            'story_fr' => ['sometimes', 'nullable', 'string', 'max:3000'],
            'story_en' => ['sometimes', 'nullable', 'string', 'max:3000'],
            'youtube' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'x' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'linkedin' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'snapchat' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'telegram' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
            'website' => ['sometimes', 'nullable', 'url:http,https', 'max:255'],
        ]);

        $before = $about->all();
        $about->save($data);
        $after = $about->all();

        $activity->log($request->user(), 'settings.about_updated', null, ['before' => $before, 'after' => $after]);

        return response()->json(['data' => $after]);
    }

    public function uploadBanner(Request $request, string $slot, AboutSettings $about, ActivityLogger $activity): JsonResponse
    {
        abort_unless(in_array($slot, AboutSettings::BANNERS, true), 404);

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $about->replaceBanner($slot, $request->file('image')->store('banners', 'public'));
        $activity->log($request->user(), 'settings.about_banner_updated', null, ['slot' => $slot]);

        return response()->json(['data' => $about->all()]);
    }

    public function removeBanner(Request $request, string $slot, AboutSettings $about, ActivityLogger $activity): JsonResponse
    {
        abort_unless(in_array($slot, AboutSettings::BANNERS, true), 404);

        $about->removeBanner($slot);
        $activity->log($request->user(), 'settings.about_banner_removed', null, ['slot' => $slot]);

        return response()->json(['data' => $about->all()]);
    }
}