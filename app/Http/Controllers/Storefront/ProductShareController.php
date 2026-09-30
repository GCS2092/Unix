<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class ProductShareController extends Controller
{
    public function show(Request $request, Product $product): Response
    {
        abort_unless($product->is_published, 404);

        $lang = (string) $request->query('lang', '');
        app()->setLocale(in_array($lang, ['fr', 'en'], true) ? $lang : 'fr');

        $target = rtrim((string) config('frontend.url'), '/').'/boutique/'.$product->slug;
        $price = number_format((int) $product->price, 0, ',', ' ').' FCFA';
        $text = Str::limit(trim(strip_tags((string) $product->localizedDescription())), 150);
        $description = $text !== '' ? $price.' - '.$text : $price;

        $image = $product->imageUrl();
        if ($image && ! Str::startsWith($image, ['http://', 'https://'])) {
            $image = url($image);
        }

        return response()->view('share.product', [
            'name' => $product->localizedName(),
            'description' => $description,
            'image' => $image,
            'target' => $target,
            'shareUrl' => $request->url(),
        ]);
    }
}