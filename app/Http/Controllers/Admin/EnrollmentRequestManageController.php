<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\EnrollmentRequest;
use App\Models\User;
use App\Notifications\EnrollmentDecisionNotification;
use App\Notifications\LiveInvitationNotification;
use App\Notifications\VerifyEmailNotification;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Password;

class EnrollmentRequestManageController extends Controller
{
    private const STATUSES = ['pending', 'approved', 'rejected'];

    /** Liste filtrable et paginee, avec compteurs par statut. */
    public function browse(Request $request): JsonResponse
    {
        $status = (string) $request->query('status', 'pending');
        $courseId = (int) $request->query('course_id', 0);
        $q = trim((string) $request->query('q', ''));

        $base = EnrollmentRequest::query()
            ->when($courseId > 0, fn ($w) => $w->where('course_id', $courseId))
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.addcslashes($q, '%_\\').'%';
                $w->whereHas('user', function ($u) use ($like): void {
                    $u->where(function ($x) use ($like): void {
                        $x->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like)
                            ->orWhere('phone', 'like', $like);
                    });
                });
            });

        $counts = [];
        foreach (self::STATUSES as $s) {
            $counts[$s] = (clone $base)->where('status', $s)->count();
        }

        $page = (clone $base)
            ->when(in_array($status, self::STATUSES, true), fn ($w) => $w->where('status', $status))
            ->with(['user:id,name,email,phone,email_verified_at,is_blocked', 'course:id,title'])
            ->latest('id')
            ->paginate(20);

        $rows = $page->getCollection()->map(fn ($r) => [
            'id' => $r->id,
            'status' => $r->status,
            'message' => $r->message,
            'decision_note' => $r->decision_note,
            'created_at' => $r->created_at,
            'decided_at' => $r->decided_at,
            'user_id' => $r->user_id,
            'user_name' => $r->user?->name,
            'user_email' => $r->user?->email,
            'user_phone' => $r->user?->phone,
            'email_verified' => $r->user?->email_verified_at !== null,
            'user_blocked' => (bool) $r->user?->is_blocked,
            'course_id' => $r->course_id,
            'course_title' => $r->course?->title,
        ])->values();

        return response()->json([
            'data' => $rows,
            'counts' => $counts,
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /** Fiche complete d'une demande : personne, commandes, inscriptions, autres demandes. */
    public function show(int $id): JsonResponse
    {
        $r = EnrollmentRequest::with(['user', 'course:id,title'])->findOrFail($id);
        $user = $r->user;

        $enrollments = $user
            ? Enrollment::query()->where('user_id', $user->id)->with('course:id,title')->orderByDesc('id')->get()
            : collect();
        $current = $enrollments->firstWhere('course_id', $r->course_id);

        $orders = [];
        $ordersCount = 0;
        if ($user) {
            try {
                $ordersCount = $user->orders()->count();
                $orders = $user->orders()->latest('id')->limit(5)->get()->map(fn ($o) => [
                    'id' => $o->id,
                    'status' => $o->status,
                    'created_at' => $o->created_at,
                ])->values();
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $others = $user
            ? EnrollmentRequest::query()->where('user_id', $user->id)->where('id', '!=', $r->id)
                ->with('course:id,title')->latest('id')->limit(10)->get()
                ->map(fn ($o) => [
                    'id' => $o->id,
                    'course_title' => $o->course?->title,
                    'status' => $o->status,
                    'created_at' => $o->created_at,
                ])->values()
            : collect();

        return response()->json(['data' => [
            'id' => $r->id,
            'status' => $r->status,
            'message' => $r->message,
            'decision_note' => $r->decision_note,
            'created_at' => $r->created_at,
            'decided_at' => $r->decided_at,
            'decided_by_name' => $r->decided_by ? User::query()->whereKey($r->decided_by)->value('name') : null,
            'course' => ['id' => $r->course_id, 'title' => $r->course?->title],
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'gender' => $user->gender,
                'birth_date' => $user->birth_date ? substr((string) $user->birth_date, 0, 10) : null,
                'birth_place' => $user->birth_place,
                'birth_country' => $user->birth_country,
                'nationality' => $user->nationality,
                'country' => $user->country,
                'city' => $user->city,
                'address' => $user->address,
                'profession' => $user->profession,
                'email_verified' => $user->email_verified_at !== null,
                'is_blocked' => (bool) $user->is_blocked,
                'is_student' => (bool) $user->is_student,
                'created_at' => $user->created_at,
            ] : null,
            'enrollment_id' => $current?->id,
            'orders_count' => $ordersCount,
            'orders' => $orders,
            'enrollments' => $enrollments->map(fn ($e) => [
                'id' => $e->id,
                'course_title' => $e->course?->title,
                'progress' => (int) $e->progress,
                'completed' => $e->isCompleted(),
            ])->values(),
            'other_requests' => $others,
        ]]);
    }

    /** Renvoie l'e-mail de decision (acceptee ou refusee) a l'etudiant. */
    public function resendDecision(Request $request, int $id, ActivityLogger $activity): JsonResponse
    {
        $r = EnrollmentRequest::with(['user', 'course'])->findOrFail($id);

        if ($r->status === 'pending') {
            return response()->json(['message' => "Cette demande n'a pas encore été traitée."], 422);
        }
        if ($r->user === null || $r->course === null) {
            return response()->json(['message' => 'Demande introuvable.'], 404);
        }
        if (! LiveInvitationNotification::mailReady()) {
            return response()->json(['message' => "L'envoi d'e-mails n'est pas configuré."], 422);
        }

        $approved = $r->status === 'approved';
        $enr = $approved
            ? Enrollment::query()->where('user_id', $r->user_id)->where('course_id', $r->course_id)->first()
            : null;
        if ($approved && $enr === null) {
            return response()->json(['message' => "L'inscription n'existe plus : rien à renvoyer."], 422);
        }

        $key = 'request-decision-mail:'.$r->id;
        if (! Cache::add($key, 1, now()->addMinutes(3))) {
            return response()->json(['message' => 'Un e-mail vient déjà d\'être renvoyé. Patientez quelques minutes.'], 429);
        }

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $url = $enr ? $base.'/etudiant/cours/'.$enr->id : $base.'/formations/'.$r->course->slug;

        try {
            $r->user->notify(new EnrollmentDecisionNotification((string) $r->course->title, $approved, $url, $r->decision_note));
        } catch (\Throwable $e) {
            Cache::forget($key);
            report($e);

            return response()->json(['message' => "L'e-mail n'a pas pu être envoyé."], 500);
        }

        $this->log($activity, $request, 'enrollment_request.mail_resent', $r, ['user_id' => $r->user_id]);

        return response()->json(['data' => ['id' => $r->id]]);
    }

    /** Envoie a l'etudiant un lien de verification d'e-mail ou de definition de mot de passe. */
    public function resendLink(Request $request, int $id, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate(['type' => ['required', 'in:verify,password']]);

        $r = EnrollmentRequest::with('user')->findOrFail($id);
        $user = $r->user;
        if ($user === null) {
            return response()->json(['message' => 'Compte introuvable.'], 404);
        }
        if ($user->is_blocked) {
            return response()->json(['message' => 'Ce compte est bloqué.'], 422);
        }
        if ($data['type'] === 'verify' && $user->email_verified_at !== null) {
            return response()->json(['message' => "L'adresse e-mail est déjà vérifiée."], 422);
        }

        $key = 'request-link-mail:'.$user->id.':'.$data['type'];
        if (! Cache::add($key, 1, now()->addMinutes(3))) {
            return response()->json(['message' => 'Un lien vient déjà d\'être envoyé. Patientez quelques minutes.'], 429);
        }

        try {
            if ($data['type'] === 'verify') {
                $user->notify(new VerifyEmailNotification);
            } else {
                $status = Password::sendResetLink(['email' => $user->email]);
                if ($status !== Password::RESET_LINK_SENT) {
                    Cache::forget($key);

                    return response()->json(['message' => "Le lien n'a pas pu être envoyé."], 422);
                }
            }
        } catch (\Throwable $e) {
            Cache::forget($key);
            report($e);

            return response()->json(['message' => "Le lien n'a pas pu être envoyé."], 500);
        }

        $this->log($activity, $request, 'enrollment_request.link_sent', $r, [
            'user_id' => $user->id,
            'type' => $data['type'],
        ]);

        return response()->json(['data' => ['id' => $r->id]]);
    }

    public function export(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $status = (string) $request->query('status', '');
        $courseId = (int) $request->query('course_id', 0);
        $q = trim((string) $request->query('q', ''));

        $query = EnrollmentRequest::query()
            ->with(['user', 'course:id,title'])
            ->when(in_array($status, self::STATUSES, true), fn ($w) => $w->where('status', $status))
            ->when($courseId > 0, fn ($w) => $w->where('course_id', $courseId))
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.addcslashes($q, '%_\\').'%';
                $w->whereHas('user', function ($u) use ($like): void {
                    $u->where(function ($x) use ($like): void {
                        $x->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like)
                            ->orWhere('phone', 'like', $like);
                    });
                });
            });

        // Neutralise l'injection de formules Excel (=, +, -, @ en debut de cellule)
        $safe = fn ($v) => (is_string($v) && $v !== '' && str_contains('=+-@', $v[0])) ? "'".$v : $v;
        $date = fn ($d) => $d ? \Illuminate\Support\Carbon::parse((string) $d)->format('d/m/Y') : '';
        $country = function (?string $code): string {
            if (! $code) {
                return '';
            }

            return function_exists('locale_get_display_region') ? (string) (locale_get_display_region('-'.$code, 'fr') ?: $code) : $code;
        };
        $age = function ($d): string {
            try {
                return $d ? (string) \Illuminate\Support\Carbon::parse((string) $d)->age : '';
            } catch (\Throwable) {
                return '';
            }
        };
        $statusLabel = ['pending' => 'En attente', 'approved' => 'Acceptée', 'rejected' => 'Refusée'];
        $gender = ['male' => 'Homme', 'female' => 'Femme'];

        $path = tempnam(sys_get_temp_dir(), 'req');
        $writer = new \OpenSpout\Writer\XLSX\Writer();
        $writer->openToFile($path);
        $writer->getCurrentSheet()->setName('Demandes');
        $writer->addRow(\OpenSpout\Common\Entity\Row::fromValuesWithStyle([
            'Nom', 'E-mail', 'Téléphone', 'Sexe', 'Date de naissance', 'Âge', 'Lieu de naissance', 'Pays de naissance',
            'Nationalité', 'Pays de résidence', 'Ville de résidence', 'Adresse', 'Profession',
            'Cours', 'Statut', 'Message', 'Demande du', 'Décision du',
        ], (new \OpenSpout\Common\Entity\Style\Style())->withFontBold(true)));

        foreach ($query->lazyById(500) as $r) {
            $u = $r->user;
            $phone = (string) ($u?->phone ?? '');
            $writer->addRow(\OpenSpout\Common\Entity\Row::fromValues([
                $safe($u?->name ?? ''),
                $safe($u?->email ?? ''),
                preg_match('/^\+\d{6,15}$/', $phone) === 1 ? $phone : $safe($phone),
                $gender[$u?->gender ?? ''] ?? '',
                $date($u?->birth_date),
                $age($u?->birth_date),
                $safe($u?->birth_place ?? ''),
                $country($u?->birth_country),
                $country($u?->nationality),
                $country($u?->country),
                $safe($u?->city ?? ''),
                $safe($u?->address ?? ''),
                $safe($u?->profession ?? ''),
                $safe($r->course?->title ?? ''),
                $statusLabel[$r->status] ?? (string) $r->status,
                $safe((string) ($r->message ?? '')),
                $date($r->created_at),
                $date($r->decided_at),
            ]));
        }
        $writer->close();

        return response()
            ->download($path, 'demandes-'.now()->format('Y-m-d').'.xlsx', [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])
            ->deleteFileAfterSend(true);
    }

    private function log(ActivityLogger $activity, Request $request, string $action, EnrollmentRequest $r, array $meta): void
    {
        try {
            $activity->log($request->user(), $action, $r, $meta);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}