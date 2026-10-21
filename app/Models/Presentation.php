<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Presentation extends Model
{
    protected $fillable = ['space', 'content'];

    protected $casts = ['content' => 'array'];

    /** Contenu de depart : generique, sans chiffres ni adresse inventes. */
    public static function defaults(string $space): array
    {
        $common = [
            'published' => true,
            'advantages' => [],
            'location_name' => '',
            'location_address_fr' => '', 'location_address_en' => '',
            'location_hours_fr' => '', 'location_hours_en' => '',
            'location_map_url' => '',
            'contact_phone' => '', 'contact_email' => '',
            'show_faq' => true,
            'show_courses' => false,
            'intro_title_fr' => '', 'intro_title_en' => '',
            'intro_fr' => '', 'intro_en' => '',
            'hero_image' => '', 'story_image' => '', 'gallery' => [],
        ];

        if ($space === 'home') {
            return array_merge($common, [
                'show_faq' => false,
                'hero_title_fr' => 'Bienvenue', 'hero_title_en' => 'Welcome',
                'hero_subtitle_fr' => 'Notre boutique et nos formations, au même endroit.',
                'hero_subtitle_en' => 'Our shop and our courses, in one place.',
                'steps' => [],
            ]);
        }

        if ($space === 'formation') {
            return array_merge($common, [
                'show_courses' => true,
                'hero_title_fr' => 'Nos formations', 'hero_title_en' => 'Our training courses',
                'hero_subtitle_fr' => 'Découvrez nos formations et inscrivez-vous en quelques minutes.',
                'hero_subtitle_en' => 'Discover our courses and sign up in a few minutes.',
                'steps' => [
                    ['title_fr' => 'Choisissez une formation', 'title_en' => 'Choose a course', 'text_fr' => 'Parcourez le catalogue et repérez la formation qui vous convient.', 'text_en' => 'Browse the catalogue and find the course that suits you.'],
                    ['title_fr' => 'Envoyez votre demande', 'title_en' => 'Send your request', 'text_fr' => "Remplissez le formulaire : votre compte est créé et votre demande est transmise à l'équipe.", 'text_en' => 'Fill in the form: your account is created and your request goes to the team.'],
                    ['title_fr' => 'Soyez prévenu par e-mail', 'title_en' => 'Get notified by e-mail', 'text_fr' => "L'équipe valide votre demande et vous recevez un e-mail avec l'accès à votre cours.", 'text_en' => 'The team approves your request and you receive an e-mail with access to your course.'],
                ],
            ]);
        }

        return array_merge($common, [
            'hero_title_fr' => 'Notre boutique', 'hero_title_en' => 'Our shop',
            'hero_subtitle_fr' => 'Découvrez nos produits et commandez en quelques clics.',
            'hero_subtitle_en' => 'Discover our products and order in a few clicks.',
            'steps' => [
                ['title_fr' => 'Choisissez', 'title_en' => 'Choose', 'text_fr' => 'Parcourez la boutique et ajoutez vos articles au panier.', 'text_en' => 'Browse the shop and add items to your cart.'],
                ['title_fr' => 'Commandez', 'title_en' => 'Order', 'text_fr' => 'Validez votre panier et passez commande.', 'text_en' => 'Confirm your cart and place your order.'],
                ['title_fr' => 'Suivez votre commande', 'title_en' => 'Track your order', 'text_fr' => "Suivez votre commande jusqu'à la réception avec votre numéro de suivi.", 'text_en' => 'Follow your order until delivery with your tracking number.'],
            ],
        ]);
    }

    public static function forSpace(string $space): array
    {
        $row = static::query()->where('space', $space)->first();

        return array_merge(self::defaults($space), $row?->content ?? []);
    }

    /** Ajoute les URL publiques des images (servies par /api/v1/presentations/media/{name}). */
    public static function present(array $c): array
    {
        $base = rtrim((string) config('app.url'), '/').'/api/v1/presentations/media/';
        $url = fn ($n) => $n ? $base.rawurlencode(basename((string) $n)) : '';

        $c['hero_image_url'] = $url($c['hero_image'] ?? '');
        $c['story_image_url'] = $url($c['story_image'] ?? '');
        $c['gallery_urls'] = array_values(array_map($url, array_filter((array) ($c['gallery'] ?? []))));

        return $c;
    }
}