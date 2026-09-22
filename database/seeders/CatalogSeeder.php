<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Product;
use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        Course::factory()->count(3)->create();
        Product::factory()->count(5)->create();
    }
}
