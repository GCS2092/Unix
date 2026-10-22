<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Services\ActivityLogger;
use App\Services\CertificateService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CertificateAdminController extends Controller
{
    private const BATCH = 10;
    private const READY_LIMIT = 500;

    private function base(Request $request, bool $with = true): Builder
    {
        $courseId = (int) $request->query('course_id', 0);
        $q = trim((string) $request->query('q', ''));

        return Enrollment::query()
            ->when($with, fn ($w) => $w->with(['user:id,name,email', 'course:id,title', 'certificate:id,enrollment_id,issued_at']))
            ->when($courseId > 0, fn ($w) => $w->where('course_id', $courseId))
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.addcslashes($q, '%_\\').'%';
                $w->where(function ($x) use ($like): void {
                    $x->whereHas('user', fn ($u) => $u->where('name', 'like', $like)->orWhere('email', 'like', $like))
                        ->orWhereHas('course', fn ($c) => $c->where('title', 'like', $like));
                });
            });
    }

    private function inProgress(Builder $query): Builder
    {
        return $query->whereDoesntHave('certificate')->where('progress', '<', 100)->whereNull('completed_at');
    }

    /** Parmi les cours termines sans certificat : [ids prets, ids bloques par l'examen]. */
    private function classified(Request $request): array
    {
        $ready = [];
        $blocked = [];

        $this->base($request, false)
            ->whereDoesntHave('certificate')
            ->where(fn ($x) => $x->where('progress', '>=', 100)->orWhereNotNull('completed_at'))
            ->lazyById(200)
            ->each(function (Enrollment $e) use (&$ready, &$blocked): void {
                try {
                    $ok = $e->examPassed();
                } catch (\Throwable) {
                    $ok = false;
                }
                if ($ok) {
                    $ready[] = $e->id;
                } else {
                    $blocked[] = $e->id;
                }
            });

        return [$ready, $blocked];
    }

    private function statusOf(Enrollment $e): string
    {
        if ($e->certificate !== null) {
            return 'issued';
        }
        if (! $e->isCompleted()) {
            return 'in_progress';
        }

        return $e->examPassed() ? 'ready' : 'blocked';
    }

    /** @return array<string, mixed> */
    private function row(Enrollment $e): array
    {
        return [
            'id' => $e->id,
            'user_name' => $e->user?->name,
            'user_email' => $e->user?->email,
            'course_id' => $e->course_id,
            'course_title' => $e->course?->title,
            'progress' => (int) $e->progress,
            'completed' => $e->isCompleted(),
            'exam_required' => $e->examRequired(),
            'exam_passed' => $e->examPassed(),
            'status' => $this->statusOf($e),
            'certificate_id' => $e->certificate?->id,
            'certificate_issued_at' => $e->certificate?->issued_at?->toIso8601String(),
            'completed_at' => $e->completed_at?->toIso8601String(),
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $status = (string) $request->query('status', 'ready');
        [$ready, $blocked] = $this->classified($request);
        $base = $this->base($request);

        $counts = [
            'ready' => count($ready),
            'blocked' => count($blocked),
            'issued' => (clone $base)->whereHas('certificate')->count(),
            'in_progress' => $this->inProgress(clone $base)->count(),
        ];

        $query = match ($status) {
            'ready' => (clone $base)->whereIn('id', $ready),
            'blocked' => (clone $base)->whereIn('id', $blocked),
            'issued' => (clone $base)->whereHas('certificate'),
            'in_progress' => $this->inProgress(clone $base),
            default => clone $base,
        };

        $page = $query->latest('id')->paginate(20);

        return response()->json([
            'data' => $page->getCollection()->map(fn (Enrollment $e) => $this->row($e))->values(),
            'counts' => $counts,
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function readyIds(Request $request): JsonResponse
    {
        [$ready] = $this->classified($request);

        return response()->json([
            'data' => array_slice($ready, 0, self::READY_LIMIT),
            'total' => count($ready),
        ]);
    }

    /** Eleves avec toutes leurs formations et l'etat de leur certificat (une inscription = au plus un certificat). */
    public function students(Request $request): JsonResponse
    {
        $courseId = (int) $request->query('course_id', 0);
        $q = trim((string) $request->query('q', ''));

        $enrolled = Enrollment::query()->select('user_id')
            ->when($courseId > 0, fn ($w) => $w->where('course_id', $courseId));

        $users = \App\Models\User::query()
            ->select(['id', 'name', 'email', 'email_verified_at', 'is_blocked'])
            ->whereIn('id', $enrolled)
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.addcslashes($q, '%_\\').'%';
                $w->where(fn ($x) => $x->where('name', 'like', $like)->orWhere('email', 'like', $like));
            })
            ->orderBy('name')
            ->paginate(15);

        $byUser = Enrollment::query()
            ->with(['course:id,title', 'certificate:id,enrollment_id,issued_at'])
            ->whereIn('user_id', $users->getCollection()->pluck('id'))
            ->when($courseId > 0, fn ($w) => $w->where('course_id', $courseId))
            ->orderBy('id')
            ->get()
            ->groupBy('user_id');

        $data = $users->getCollection()->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'email_verified' => $u->email_verified_at !== null,
            'blocked' => (bool) $u->is_blocked,
            'enrollments' => ($byUser[$u->id] ?? collect())->map(function (Enrollment $e) use ($u) {
                $e->setRelation('user', $u);

                return $this->row($e);
            })->values(),
        ])->values();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /** Informations de l'eleve telles qu'elles figurent sur le certificat. */
    public function identity(Enrollment $enrollment): JsonResponse
    {
        $enrollment->loadMissing(['user', 'course:id,title', 'certificate:id,enrollment_id']);
        $u = $enrollment->user;
        abort_if($u === null, 404);

        $birth = null;
        try {
            $birth = filled($u->birth_date ?? null) ? \Illuminate\Support\Carbon::parse((string) $u->birth_date)->format('Y-m-d') : null;
        } catch (\Throwable) {
            $birth = null;
        }

        return response()->json(['data' => [
            'name' => $u->name,
            'email' => $u->email,
            'birth_date' => $birth,
            'birth_place' => $u->birth_place ?? null,
            'birth_country' => $u->birth_country ?? null,
            'course_title' => $enrollment->course?->title,
            'has_certificate' => $enrollment->certificate !== null,
        ]]);
    }

    /** Corrige les informations de l'eleve et regenere le PDF s'il existe deja (meme code de verification). */
    public function correct(Request $request, Enrollment $enrollment, CertificateService $certificates, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'birth_date' => ['nullable', 'date', 'before:today', 'after:1900-01-01'],
            'birth_place' => ['nullable', 'string', 'max:120'],
            'birth_country' => ['nullable', 'string', 'size:2'],
        ]);

        $user = $enrollment->user;
        abort_if($user === null, 404);

        $before = $user->only(['name', 'birth_date', 'birth_place', 'birth_country']);
        $user->forceFill([
            'name' => trim(preg_replace('/\s+/u', ' ', $data['name']) ?? $data['name']),
            'birth_date' => $data['birth_date'] ?? null,
            'birth_place' => filled($data['birth_place'] ?? null) ? trim($data['birth_place']) : null,
            'birth_country' => filled($data['birth_country'] ?? null) ? strtoupper($data['birth_country']) : null,
        ])->save();

        $regenerated = false;
        try {
            $enrollment->unsetRelation('user');
            $enrollment->load(['user', 'course', 'certificate']);
            if ($enrollment->certificate !== null) {
                $certificates->regenerate($enrollment);
                $regenerated = true;
            }
        } catch (\Throwable $ex) {
            if (! $ex instanceof \RuntimeException) {
                report($ex);
            }

            return response()->json([
                'message' => 'Informations enregistrées, mais le PDF n\'a pas pu être régénéré : '.($ex instanceof \RuntimeException ? $ex->getMessage() : 'erreur de génération.').' Utilisez « Réémettre ».',
            ], 422);
        }

        try {
            $activity->log($request->user(), 'certificate.corrected', $enrollment, [
                'enrollment_id' => $enrollment->id, 'user_id' => $user->id, 'before' => $before, 'regenerated' => $regenerated,
            ]);
        } catch (\Throwable $logError) {
            report($logError);
        }

        return response()->json(['data' => ['regenerated' => $regenerated]]);
    }

    /** Dates d'envoi par e-mail, indexees par id d'inscription (?ids[]=1&ids[]=2). */
    public function emailed(Request $request): JsonResponse
    {
        $ids = array_map('intval', array_slice((array) $request->query('ids', []), 0, 200));
        $rows = \App\Models\Certificate::query()
            ->whereIn('enrollment_id', $ids)->whereNotNull('emailed_at')
            ->get(['enrollment_id', 'emailed_at']);

        return response()->json(['data' => $rows->mapWithKeys(
            fn ($c) => [$c->enrollment_id => $c->emailed_at?->toIso8601String()],
        )->all()]);
    }

    /** Envoie le certificat par e-mail a l'adresse du compte (l'emet d'abord s'il n'existe pas encore). */
    public function send(Request $request, CertificateService $certificates, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:5'],
            'ids.*' => ['integer'],
        ]);

        if (! \App\Notifications\LiveInvitationNotification::mailReady()) {
            return response()->json(['message' => "L'envoi d'e-mails n'est pas configuré."], 422);
        }

        @set_time_limit(120);

        $counts = ['sent' => 0, 'failed' => 0, 'skipped' => 0];
        $results = [];
        $found = [];

        $enrollments = Enrollment::query()->with(['user', 'course', 'certificate'])->whereIn('id', $data['ids'])->get();

        foreach ($enrollments as $e) {
            $found[] = $e->id;
            $user = $e->user;

            if ($user === null || blank($user->email)) {
                $counts['failed']++;
                $results[] = ['id' => $e->id, 'status' => 'failed', 'message' => 'Compte ou adresse e-mail introuvable.'];
                continue;
            }
            if ($user->is_blocked) {
                $counts['failed']++;
                $results[] = ['id' => $e->id, 'status' => 'failed', 'message' => $user->name.' : compte bloqué.'];
                continue;
            }

            $key = 'certificate-mail:'.$e->id;
            if (! \Illuminate\Support\Facades\Cache::add($key, 1, now()->addMinutes(2))) {
                $counts['skipped']++;
                $results[] = ['id' => $e->id, 'status' => 'skipped', 'message' => 'Déjà envoyé il y a moins de 2 minutes.'];
                continue;
            }

            try {
                $certificates->issueForEnrollment($e);
                $cert = \App\Models\Certificate::query()->where('enrollment_id', $e->id)->first();
                $pdf = $cert ? $certificates->contents($cert) : null;
                if ($cert === null || $pdf === null) {
                    throw new \RuntimeException('Fichier du certificat introuvable : réémettez-le.');
                }

                $verify = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/verification/'.$cert->code;
                $filename = 'certificat-'.\Illuminate\Support\Str::slug($user->name).'-'.\Illuminate\Support\Str::slug((string) $e->course?->title).'.pdf';

                $user->notify(new \App\Notifications\CertificateDeliveredNotification(
                    (string) ($e->course?->title ?? ''), $pdf, $filename, (string) $cert->code, $verify,
                ));

                $counts['sent']++;
                \App\Models\Certificate::query()->whereKey($cert->id)->update(['emailed_at' => now()]);
                $results[] = ['id' => $e->id, 'status' => 'sent'];

                try {
                    $activity->log($request->user(), 'certificate.sent', $e, ['enrollment_id' => $e->id, 'user_id' => $user->id]);
                } catch (\Throwable $logError) {
                    report($logError);
                }
            } catch (\Throwable $ex) {
                \Illuminate\Support\Facades\Cache::forget($key);
                if (! $ex instanceof \RuntimeException) {
                    report($ex);
                }
                $counts['failed']++;
                $results[] = [
                    'id' => $e->id,
                    'status' => 'failed',
                    'message' => $ex instanceof \RuntimeException ? $ex->getMessage() : "L'e-mail n'a pas pu être envoyé.",
                ];
            }
        }

        foreach (array_diff($data['ids'], $found) as $missing) {
            $counts['skipped']++;
            $results[] = ['id' => (int) $missing, 'status' => 'skipped', 'message' => 'Inscription introuvable.'];
        }

        return response()->json(['data' => $counts + ['results' => $results]]);
    }

    /** PDF (1 certificat) ou ZIP (plusieurs). Emet les certificats manquants. Tout ou rien : une erreur annule le telechargement. */
    public function files(Request $request, CertificateService $certificates, ActivityLogger $activity): \Symfony\Component\HttpFoundation\Response
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:20'],
            'ids.*' => ['integer'],
        ]);

        @set_time_limit(120);

        $enrollments = Enrollment::query()->with(['user', 'course', 'certificate'])->whereIn('id', $data['ids'])->get();
        if ($enrollments->isEmpty()) {
            return response()->json(['message' => 'Inscription introuvable.'], 404);
        }

        $files = [];
        $errors = [];

        foreach ($enrollments as $e) {
            $label = trim(($e->user?->name ?? '?').' / '.($e->course?->title ?? '?'));
            try {
                $certificates->issueForEnrollment($e);
                $cert = \App\Models\Certificate::query()->where('enrollment_id', $e->id)->first();
                $pdf = $cert ? $certificates->contents($cert) : null;
                if ($pdf === null) {
                    throw new \RuntimeException('Fichier du certificat introuvable : réémettez-le.');
                }
                $files[] = [
                    'certificat-'.\Illuminate\Support\Str::slug($e->user?->name ?? 'eleve').'-'.\Illuminate\Support\Str::slug($e->course?->title ?? 'cours').'.pdf',
                    $pdf,
                ];
            } catch (\Throwable $ex) {
                if (! $ex instanceof \RuntimeException) {
                    report($ex);
                }
                $errors[] = $label.' : '.($ex instanceof \RuntimeException ? $ex->getMessage() : 'erreur de génération.');
            }
        }

        if ($errors !== []) {
            return response()->json(['message' => implode(' | ', array_slice($errors, 0, 3))], 422);
        }

        try {
            $activity->log($request->user(), 'certificate.exported', $enrollments->first(), ['count' => count($files)]);
        } catch (\Throwable $logError) {
            report($logError);
        }

        if (count($files) === 1) {
            return response($files[0][1], 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="'.$files[0][0].'"',
            ]);
        }

        if (! class_exists(\ZipArchive::class)) {
            return response()->json(['message' => "L'extension ZIP de PHP est absente : téléchargez les certificats un par un."], 422);
        }

        $path = tempnam(sys_get_temp_dir(), 'crt');
        $zip = new \ZipArchive();
        if ($zip->open($path, \ZipArchive::OVERWRITE) !== true) {
            return response()->json(['message' => "Impossible de créer l'archive."], 500);
        }
        $used = [];
        foreach ($files as [$name, $pdf]) {
            $n = $name;
            $i = 2;
            while (isset($used[$n])) {
                $n = preg_replace('/\.pdf$/', '', $name).'-'.$i++.'.pdf';
            }
            $used[$n] = true;
            $zip->addFromString($n, $pdf);
        }
        $zip->close();

        return response()
            ->download($path, 'certificats-'.now()->format('Y-m-d').'.zip', ['Content-Type' => 'application/zip'])
            ->deleteFileAfterSend(true);
    }

    /** Emet les certificats d'un petit lot d'inscriptions : ignore celles qui en ont deja un. */
    public function issueBatch(Request $request, CertificateService $certificates, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:'.self::BATCH],
            'ids.*' => ['integer'],
        ]);

        @set_time_limit(120);

        $results = [];
        $counts = ['issued' => 0, 'failed' => 0, 'skipped' => 0];
        $found = [];

        $enrollments = Enrollment::query()->with(['user', 'course', 'certificate'])->whereIn('id', $data['ids'])->get();

        foreach ($enrollments as $e) {
            $found[] = $e->id;

            if ($e->certificate !== null) {
                $counts['skipped']++;
                $results[] = ['id' => $e->id, 'status' => 'skipped', 'message' => 'Déjà délivré.'];
                continue;
            }

            try {
                $certificates->issueForEnrollment($e);
                $counts['issued']++;
                $results[] = ['id' => $e->id, 'status' => 'issued'];

                try {
                    $activity->log($request->user(), 'certificate.issued', $e, ['enrollment_id' => $e->id, 'batch' => true]);
                } catch (\Throwable $logError) {
                    report($logError);
                }
            } catch (\Throwable $ex) {
                if (! $ex instanceof \RuntimeException) {
                    report($ex);
                }
                $counts['failed']++;
                $results[] = [
                    'id' => $e->id,
                    'status' => 'failed',
                    'message' => $ex instanceof \RuntimeException ? $ex->getMessage() : 'Erreur lors de la génération du PDF.',
                ];
            }
        }

        foreach (array_diff($data['ids'], $found) as $missing) {
            $counts['skipped']++;
            $results[] = ['id' => (int) $missing, 'status' => 'skipped', 'message' => 'Inscription introuvable.'];
        }

        return response()->json(['data' => $counts + ['results' => $results]]);
    }
}