<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Presentation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;

class PresentationController extends Controller
{
    private const IMAGE_KEYS = ['hero_image', 'story_image', 'gallery'];
    private const MAX_GALLERY = 8;

    public function show(string $space): JsonResponse
    {
        return response()->json(['data' => Presentation::present(Presentation::forSpace($space))]);
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
            'intro_title_fr' => ['nullable', 'string', 'max:120'],
            'intro_title_en' => ['nullable', 'string', 'max:120'],
            'intro_fr' => ['nullable', 'string', 'max:3000'],
            'intro_en' => ['nullable', 'string', 'max:3000'],
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

        // Les images ne sont gerees que par upload/remove : on les conserve telles quelles.
        $keep = Arr::only(Presentation::forSpace($space), self::IMAGE_KEYS);
        Presentation::query()->updateOrCreate(['space' => $space], ['content' => array_merge($data, $keep)]);

        return response()->json(['data' => Presentation::present(Presentation::forSpace($space))]);
    }

    public function upload(Request $request, string $space): JsonResponse
    {
        $request->validate([
            'slot' => ['required', 'in:hero,story,gallery'],
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $content = Presentation::forSpace($space);
        $slot = (string) $request->input('slot');

        if ($slot === 'gallery' && count((array) $content['gallery']) >= self::MAX_GALLERY) {
            return response()->json(['message' => 'La galerie est limitée à '.self::MAX_GALLERY.' images.'], 422);
        }

        $name = basename($request->file('image')->store('presentations', 'public'));

        if ($slot === 'gallery') {
            $content['gallery'] = array_values(array_merge((array) $content['gallery'], [$name]));
        } else {
            $key = $slot.'_image';
            $this->deleteFile($content[$key] ?? '');
            $content[$key] = $name;
        }

        Presentation::query()->updateOrCreate(['space' => $space], ['content' => $content]);

        return response()->json(['data' => Presentation::present($content)]);
    }

    public function remove(Request $request, string $space): JsonResponse
    {
        $data = $request->validate([
            'slot' => ['required', 'in:hero,story,gallery'],
            'index' => ['nullable', 'integer', 'min:0'],
        ]);

        $content = Presentation::forSpace($space);

        if ($data['slot'] === 'gallery') {
            $gallery = array_values((array) $content['gallery']);
            $i = (int) ($data['index'] ?? -1);
            if (! isset($gallery[$i])) {
                return response()->json(['message' => 'Image introuvable.'], 404);
            }
            $this->deleteFile($gallery[$i]);
            array_splice($gallery, $i, 1);
            $content['gallery'] = $gallery;
        } else {
            $key = $data['slot'].'_image';
            $this->deleteFile($content[$key] ?? '');
            $content[$key] = '';
        }

        Presentation::query()->updateOrCreate(['space' => $space], ['content' => $content]);

        return response()->json(['data' => Presentation::present($content)]);
    }

    private function deleteFile(mixed $name): void
    {
        if (is_string($name) && $name !== '') {
            Storage::disk('public')->delete('presentations/'.basename($name));
        }
    }
}