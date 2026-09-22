<?php

namespace Database\Factories;

use App\Models\Certificate;
use App\Models\Enrollment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Certificate>
 */
class CertificateFactory extends Factory
{
    protected $model = Certificate::class;

    public function definition(): array
    {
        return [
            'enrollment_id' => Enrollment::factory()->completed(),
            'file_path' => 'certificates/demo-'.fake()->uuid().'.pdf',
            'issued_at' => now(),
        ];
    }
}
