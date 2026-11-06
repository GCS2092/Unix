<?php

namespace Database\Seeders;

use App\Enums\StockMovementReason;
use App\Models\Category;
use App\Models\Product;
use App\Services\StockService;
use Illuminate\Database\Seeder;

class SurveyingDemoSeeder extends Seeder
{
    public function run(StockService $stock): void
    {
        $cat = Category::query()->where('slug', 'topographie')->first();
        if (! $cat) {
            try {
                $cat = new Category;
                $cat->forceFill(['name' => 'Topographie', 'slug' => 'topographie', 'is_active' => true])->save();
            } catch (\Throwable $e) {
                $this->command?->warn('Categorie non creee : '.$e->getMessage());
                $cat = null;
            }
        }

        $img = fn (string $label, string $bg) => 'https://placehold.co/800x800/'.$bg.'/ffffff/png?text='.rawurlencode($label);

        $make = function (string $key, array $d) use ($stock, $cat, $img): Product {
            $slug = 'demo-'.$key;
            $existing = Product::query()->where('slug', $slug)->first();
            if ($existing) {
                return $existing;
            }

            $p = Product::query()->create([
                'name' => $d['name'],
                'name_en' => $d['name_en'],
                'slug' => $slug,
                'description' => $d['desc'],
                'price' => $d['price'],
                'stock' => 0,
                'is_published' => true,
                'kind' => $d['kind'],
                'category_id' => $cat?->id,
                'image_link' => $img($d['name'], $d['bg']),
                'specs' => $d['specs'] ?? null,
                'delivery_info' => 'Livraison à Dakar sous 48 h. Retrait possible en boutique.',
            ]);

            try {
                $tags = ['device' => 'Appareil', 'accessory' => 'Accessoire', 'bundle' => 'Pack'];
                $path = DemoImage::apply($p, $key) ? $p->image_path : DemoImage::store($d['name'], $d['bg'], $tags[$d['kind']] ?? '');
                $p->update(['image_path' => $path, 'image_disk' => 'public', 'image_link' => null]);
            } catch (\Throwable $e) {
                $this->command?->warn('Image non generee ('.$slug.') : '.$e->getMessage());
            }

            if ($d['kind'] !== 'bundle' && $d['stock'] > 0) {
                $stock->adjust($p, $d['stock'], StockMovementReason::Initial, null, 'Stock initial (démo)');
            }

            return $p;
        };

        $P = [];
        $defs = [
            'station-totale' => ['device', 'Station totale 5" motorisée', 'Motorized total station 5"', 2450000, 4, '1d4ed8', "Précision angulaire : 5\"\nPortée sans prisme : 800 m\nAutonomie : 8 h\nPoids : 4,6 kg", 'Station totale motorisée pour implantation et levés.'],
            'gnss-rtk' => ['device', 'Récepteur GNSS RTK', 'GNSS RTK receiver', 1850000, 3, '0f766e', "Constellations : GPS, GLONASS, Galileo, BeiDou\nPrécision RTK : 8 mm + 1 ppm\nAutonomie : 12 h", 'Récepteur GNSS RTK multi-constellation.'],
            'niveau-auto' => ['device', 'Niveau automatique 32x', 'Automatic level 32x', 420000, 6, '7c3aed', "Grossissement : 32x\nPrécision : 1,0 mm / km", 'Niveau automatique pour nivellement de précision.'],
            'drone-photo' => ['device', 'Drone photogrammétrie', 'Photogrammetry drone', 3200000, 2, 'b45309', "Capteur : 20 MP\nAutonomie : 40 min\nPositionnement : RTK", 'Drone de cartographie et photogrammétrie.'],
            'tripied-alu' => ['accessory', 'Trépied aluminium', 'Aluminium tripod', 85000, 8, '475569', null, 'Trépied aluminium à verrouillage rapide.'],
            'jalon' => ['accessory', 'Jalon télescopique 2,5 m', 'Telescopic pole 2.5 m', 45000, 6, '475569', null, 'Jalon télescopique avec niveau sphérique.'],
            'prisme' => ['accessory', 'Prisme circulaire', 'Circular prism', 120000, 5, '475569', null, 'Prisme circulaire avec cible.'],
            'batterie-station' => ['accessory', 'Batterie Li-ion station', 'Li-ion battery (station)', 65000, 10, '475569', null, 'Batterie rechargeable pour station totale.'],
            'batterie-gnss' => ['accessory', 'Batterie Li-ion GNSS', 'Li-ion battery (GNSS)', 55000, 8, '475569', null, 'Batterie rechargeable pour récepteur GNSS.'],
            'batterie-drone' => ['accessory', 'Batterie intelligente drone', 'Smart drone battery', 150000, 6, '475569', null, 'Batterie de vol pour drone de cartographie.'],
            'chargeur' => ['accessory', 'Chargeur de batterie', 'Battery charger', 38000, 7, '475569', null, 'Chargeur secteur.'],
            'mallette' => ['accessory', 'Mallette de transport rigide', 'Rigid carrying case', 60000, 3, '475569', null, 'Mallette rigide étanche.'],
            'canne-gnss' => ['accessory', 'Canne GNSS carbone', 'Carbon GNSS pole', 78000, 5, '475569', null, 'Canne en carbone, 2 m.'],
            'mire' => ['accessory', 'Mire de nivellement 5 m', 'Levelling staff 5 m', 65000, 2, '475569', null, 'Mire télescopique graduée.'],
            'carnet' => ['accessory', 'Carnet de terrain (rupture)', 'Field book (out of stock)', 8000, 0, '475569', null, 'Carnet de terrain étanche.'],
        ];
        foreach ($defs as $key => [$kind, $name, $nameEn, $price, $st, $bg, $specs, $desc]) {
            $P[$key] = $make($key, ['kind' => $kind, 'name' => $name, 'name_en' => $nameEn, 'price' => $price, 'stock' => $st, 'bg' => $bg, 'specs' => $specs, 'desc' => $desc]);
        }

        $P['pack-station-complet'] = $make('pack-station-complet', ['kind' => 'bundle', 'name' => 'Pack Station totale complet', 'name_en' => 'Complete total station pack', 'price' => 2590000, 'stock' => 0, 'bg' => 'be123c', 'specs' => null, 'desc' => 'Station totale, trépied, prisme, jalon et mallette : prêt à travailler.']);
        $P['pack-niveau'] = $make('pack-niveau', ['kind' => 'bundle', 'name' => 'Pack Niveau de chantier', 'name_en' => 'Site level pack', 'price' => 520000, 'stock' => 0, 'bg' => 'be123c', 'specs' => null, 'desc' => 'Niveau automatique, trépied et mire.']);

        $links = [
            'station-totale' => ['tripied-alu' => true, 'batterie-station' => true, 'chargeur' => true, 'prisme' => false, 'jalon' => false, 'mallette' => false, 'carnet' => false],
            'gnss-rtk' => ['canne-gnss' => true, 'batterie-gnss' => true, 'mallette' => false],
            'niveau-auto' => ['tripied-alu' => true, 'mire' => true],
            'drone-photo' => ['batterie-drone' => true, 'mallette' => false],
        ];
        foreach ($links as $device => $acc) {
            $sync = [];
            $i = 0;
            foreach ($acc as $a => $required) {
                $sync[$P[$a]->id] = ['is_required' => $required, 'position' => $i++];
            }
            $P[$device]->accessories()->syncWithoutDetaching($sync);
        }

        $bundles = [
            'pack-station-complet' => ['station-totale' => 1, 'tripied-alu' => 1, 'prisme' => 1, 'jalon' => 1, 'mallette' => 1],
            'pack-niveau' => ['niveau-auto' => 1, 'tripied-alu' => 1, 'mire' => 1],
        ];
        foreach ($bundles as $b => $parts) {
            $sync = [];
            $i = 0;
            foreach ($parts as $c => $q) {
                $sync[$P[$c]->id] = ['quantity' => $q, 'position' => $i++];
            }
            $P[$b]->components()->syncWithoutDetaching($sync);
        }

        $this->command?->info('Demo topographie : '.count($P).' produits.');
    }
}