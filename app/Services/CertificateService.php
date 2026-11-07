<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\Enrollment;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CertificateService
{
    public function issueForEnrollment(Enrollment $enrollment): string
    {
        $enrollment->loadMissing(['user', 'course', 'certificate']);

        if ($enrollment->certificate !== null) {
            return $enrollment->certificate->file_path;
        }

        if (! $enrollment->isCompleted()) {
            throw new \RuntimeException('Le cours n\'est pas termine.');
        }

        if (! $enrollment->examPassed()) {
            throw new \RuntimeException('Vous devez réussir l\'examen final avant d\'obtenir le certificat.');
        }

        $code = $this->newCode();
        $verifyUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/verification/'.$code;

        $pdf = Pdf::loadView('certificates.course', [
            'userName' => $enrollment->user->name,
            'courseTitle' => $enrollment->course->title,
            'issuedAt' => now(),
            'code' => $code,
            'verifyUrl' => $verifyUrl,
            'birthDate' => $this->birthDate($enrollment->user->birth_date ?? null),
            'birthPlace' => $this->birthPlace($enrollment->user),
            'tpl' => $this->template(),
            'qr' => $this->qr($verifyUrl),
        ]);

        $path = 'certificates/enrollment-'.$enrollment->id.'.pdf';
        $disk = $this->disk();

        $written = Storage::disk($disk)->put($path, $pdf->output());

        if ($written === false) {
            Log::error('Echec de l\'ecriture du certificat sur le disque.', [
                'enrollment_id' => $enrollment->id,
                'disk' => $disk,
                'path' => $path,
            ]);

            throw new \RuntimeException('Impossible d\'enregistrer le fichier du certificat.');
        }

        Certificate::query()->create([
            'enrollment_id' => $enrollment->id,
            'file_path' => $path,
            'issued_at' => now(),
            'code' => $code,
        ]);

        return $path;
    }

    /** Regenere le PDF d'un certificat deja emis (memes code et date), apres correction des informations de l'eleve. */
    public function regenerate(Enrollment $enrollment, bool $resetEmailed = true): void
    {
        $enrollment->loadMissing(['user', 'course', 'certificate']);
        $cert = $enrollment->certificate;
        if ($cert === null) {
            throw new \RuntimeException('Aucun certificat à régénérer.');
        }

        $verifyUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/verification/'.$cert->code;
        $pdf = Pdf::loadView('certificates.course', [
            'userName' => $enrollment->user->name,
            'courseTitle' => $enrollment->course->title,
            'issuedAt' => $cert->issued_at ?? now(),
            'code' => $cert->code,
            'verifyUrl' => $verifyUrl,
            'birthDate' => $this->birthDate($enrollment->user->birth_date ?? null),
            'birthPlace' => $this->birthPlace($enrollment->user),
            'tpl' => $this->template(),
            'qr' => $this->qr($verifyUrl),
        ]);

        $path = $cert->file_path ?: 'certificates/enrollment-'.$enrollment->id.'.pdf';
        if (Storage::disk($this->disk())->put($path, $pdf->output()) === false) {
            throw new \RuntimeException('Impossible d\'enregistrer le fichier du certificat.');
        }

        $cert->forceFill($resetEmailed ? ['file_path' => $path, 'emailed_at' => null] : ['file_path' => $path])->save();
    }

    /** QR code (SVG en data URI) vers la page de verification ; null si la bibliotheque n'est pas installee. */
    public function qr(string $url): ?string
    {
        if (! class_exists(\BaconQrCode\Writer::class)) {
            return null;
        }
        try {
            $renderer = new \BaconQrCode\Renderer\ImageRenderer(
                new \BaconQrCode\Renderer\RendererStyle\RendererStyle(240, 0),
                new \BaconQrCode\Renderer\Image\SvgImageBackEnd(),
            );
            $svg = (new \BaconQrCode\Writer($renderer))->writeString($url);

            return 'data:image/svg+xml;base64,'.base64_encode($svg);
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    /** Reglages du modele (organisme, signataires, logo, signatures, tampon, couleur) prets pour la vue PDF. */
    public function template(): array
    {
        $s = \App\Models\CertificateSetting::values();
        $custom = $this->asset($s['logo']);

        $color = preg_match('/^#[0-9a-f]{6}$/i', $s['color']) === 1 ? $s['color'] : '#1f64c0';
        if (strtolower($color) === '#0b4a6f') {
            $color = '#1f64c0'; // ancienne couleur par defaut : on prend le bleu IGA
        }

        return [
            'brand' => $s['brand'] !== '' ? $s['brand'] : 'International Geospatial Academy',
            'signer_name' => $s['signer_name'],
            'signer_title' => $s['signer_title'],
            'signer2_name' => $s['signer2_name'],
            'signer2_title' => $s['signer2_title'],
            'color' => $color,
            'accent' => '#3fa535',
            'logo' => $custom ?? $this->defaultLogo(),
            'logo_is_default' => $custom === null,
            'signature' => $this->asset($s['signature']),
            'signature2' => $this->asset($s['signature2']),
            'stamp' => $this->asset($s['stamp']),
        ];
    }

    /** Logo IGA integre au PDF quand aucun logo n'a ete televerse. */
    private function defaultLogo(): ?string
    {
        $file = public_path('brand/logo-iga.png');
        if (! is_file($file)) {
            return null;
        }

        return 'data:image/png;base64,'.base64_encode((string) file_get_contents($file));
    }

    private function asset(string $name): ?string
    {
        if ($name === '') {
            return null;
        }
        try {
            $path = 'certificate-assets/'.basename($name);
            $disk = \App\Support\MediaDisk::disk();
            if (! $disk->exists($path)) {
                return null;
            }
            $mime = strtolower(pathinfo($name, PATHINFO_EXTENSION)) === 'png' ? 'image/png' : 'image/jpeg';

            return 'data:'.$mime.';base64,'.base64_encode($disk->get($path));
        } catch (\Throwable) {
            return null;
        }
    }

    private function birthDate(mixed $value): ?string
    {
        if (blank($value)) {
            return null;
        }
        try {
            return \Illuminate\Support\Carbon::parse((string) $value)->format('d/m/Y');
        } catch (\Throwable) {
            return null;
        }
    }

    private function birthPlace(\App\Models\User $user): ?string
    {
        $place = trim((string) ($user->birth_place ?? ''));
        $code = (string) ($user->birth_country ?? '');
        $country = ($code !== '' && function_exists('locale_get_display_region'))
            ? (string) (locale_get_display_region('-'.$code, 'fr') ?: $code)
            : $code;
        $out = trim($place.(($place !== '' && $country !== '') ? ', ' : '').$country);

        return $out !== '' ? $out : null;
    }

    /** Contenu du PDF d'un certificat deja emis : disque configure d'abord, puis repli sur le stockage local. */
    public function contents(Certificate $certificate): ?string
    {
        $path = (string) $certificate->file_path;

        foreach (array_unique([$this->disk(), 'local', 'public']) as $name) {
            try {
                $disk = Storage::disk($name);
                if ($disk->exists($path)) {
                    return $disk->get($path);
                }
            } catch (\Throwable $e) {
                // disque indisponible : on essaie le suivant
            }
        }

        return null;
    }

    /** Code lisible (ex. K7QM2-X9PWA), sans 0/O/1/I/L. */
    private function newCode(): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

        do {
            $raw = '';
            for ($i = 0; $i < 10; $i++) {
                $raw .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $code = substr($raw, 0, 5).'-'.substr($raw, 5);
        } while (Certificate::query()->where('code', $code)->exists());

        return $code;
    }

    private function disk(): string
    {
        $preferred = config('filesystems.default');

        if ($preferred !== 'r2') {
            return 'local';
        }

        if ($this->isR2Configured()) {
            return 'r2';
        }

        Log::warning('Disque R2 configure par defaut mais credentials manquants, repli sur le stockage local.');

        return 'local';
    }

    private function isR2Configured(): bool
    {
        $disk = config('filesystems.disks.r2', []);

        return filled($disk['key'] ?? null)
            && filled($disk['secret'] ?? null)
            && filled($disk['bucket'] ?? null)
            && filled($disk['endpoint'] ?? null);
    }
}