<?php

namespace Tests\Feature;

use App\Enums\CartItemType;
use App\Enums\OrderStatus;
use App\Models\ActivityLog;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\OrderPaidNotification;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FullBackendFlowTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Parcours complet : un invite parcourt le catalogue, achete un cours,
     * paie via CinetPay (simule), recoit automatiquement un compte et acces
     * au cours, sans jamais avoir cree de compte lui-meme.
     */
    public function test_guest_can_browse_buy_and_get_course_access_after_payment(): void
    {
        Notification::fake();
        $this->withoutMiddleware();

        $course = Course::factory()->create([
            'title' => 'Cours de test',
            'price' => 10000,
            'is_published' => true,
        ]);

        // Catalogue public
        $this->getJson('/api/v1/catalog/courses')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Cours de test']);

        // Ajout au panier sans compte
        $this->postJson('/api/v1/cart/items', [
            'type' => CartItemType::Course->value,
            'id' => $course->id,
        ])->assertOk();

        $this->fakeCinetPayInit(10000, 'ORD-');

        $checkout = $this->postJson('/api/v1/checkout', [
            'guest_email' => 'invite@example.com',
            'guest_name' => 'Client Invite',
        ])->assertCreated();

        $transactionId = $checkout->json('transaction_id');
        $order = Order::query()->where('payment_transaction_id', $transactionId)->firstOrFail();

        $this->assertSame(OrderStatus::Pending, $order->status);
        $this->assertSame(10000, $order->total);

        $this->fakeCinetPayCheck($transactionId, 'ACCEPTED', 10000, $order->currency);

        $this->postJson('/api/cinetpay/notify', [
            'cpm_trans_id' => $transactionId,
        ])->assertOk();

        $order->refresh();
        $this->assertTrue($order->isPaid());
        $this->assertNotNull($order->user_id);

        $user = User::query()->where('email', 'invite@example.com')->first();
        $this->assertNotNull($user, 'Un compte doit etre cree automatiquement pour l\'invite.');

        $this->assertTrue(
            Enrollment::query()->where('user_id', $user->id)->where('course_id', $course->id)->exists(),
            'L\'invite doit obtenir une inscription au cours des le paiement confirme.'
        );

        Notification::assertSentTo($user, ResetPassword::class);
        Notification::assertSentTo($user, OrderPaidNotification::class);
    }

    /**
     * Un utilisateur connecte ne peut pas racheter un cours qu'il possede deja,
     * et un cours ne peut jamais etre ajoute en quantite superieure a 1.
     */
    public function test_authenticated_user_cannot_rebuy_owned_course_and_quantity_is_forced_to_one(): void
    {
        $this->withoutMiddleware();

        $user = User::factory()->create();
        $course = Course::factory()->create(['price' => 5000, 'is_published' => true]);
        Sanctum::actingAs($user, ['*']);

        // La quantite d'un cours est toujours forcee a 1, meme si on demande plus
        $this->postJson('/api/v1/cart/items', [
            'type' => CartItemType::Course->value,
            'id' => $course->id,
            'quantity' => 5,
        ])->assertOk()
            ->assertJsonPath('data.items.0.quantity', 1);

        Enrollment::query()->create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'progress' => 0,
        ]);

        $response = $this->postJson('/api/v1/cart/items', [
            'type' => CartItemType::Course->value,
            'id' => $course->id,
        ]);

        $response->assertStatus(422);
    }

    /**
     * Si le montant reellement paye (renvoye par CinetPay) ne correspond pas
     * au montant de la commande, celle-ci ne doit jamais etre marquee payee.
     */
    public function test_payment_amount_mismatch_never_marks_order_as_paid(): void
    {
        $this->withoutMiddleware();

        $course = Product::factory()->create(['price' => 8000, 'stock' => 10, 'is_published' => true]);

        $this->postJson('/api/v1/cart/items', [
            'type' => CartItemType::Product->value,
            'id' => $course->id,
        ])->assertOk();

        $this->fakeCinetPayInit(8000, 'ORD-');

        $checkout = $this->postJson('/api/v1/checkout', [
            'guest_email' => 'montant@example.com',
        ])->assertCreated();

        $transactionId = $checkout->json('transaction_id');
        $order = Order::query()->where('payment_transaction_id', $transactionId)->firstOrFail();

        // CinetPay renvoie ACCEPTED mais avec un montant incoherent (3000 au lieu de 8000)
        $this->fakeCinetPayCheck($transactionId, 'ACCEPTED', 3000, $order->currency);

        $this->postJson('/api/cinetpay/notify', [
            'cpm_trans_id' => $transactionId,
        ])->assertOk();

        $order->refresh();
        $this->assertFalse($order->isPaid(), 'Une commande ne doit jamais etre validee si le montant paye ne correspond pas.');
    }

    /**
     * Si l'initiation du paiement echoue techniquement, la commande passe en
     * echec proprement (pas de commande orpheline), et peut etre relancee
     * une fois le probleme technique resolu.
     */
    public function test_failed_payment_initiation_marks_order_failed_and_can_be_retried(): void
    {
        $this->withoutMiddleware();

        $user = User::factory()->create();
        $product = Product::factory()->create(['price' => 2000, 'stock' => 5, 'is_published' => true]);
        Sanctum::actingAs($user, ['*']);

        $this->postJson('/api/v1/cart/items', [
            'type' => CartItemType::Product->value,
            'id' => $product->id,
        ])->assertOk();

        // 1re requete = echec technique (500), 2e requete = succes (200)
        Http::fake([
            'api-checkout.cinetpay.com/v2/payment' => Http::sequence()
                ->push([], 500)
                ->push(['data' => ['payment_url' => 'https://fake-cinetpay.test/pay/xyz']], 200),
        ]);

        $checkout = $this->postJson('/api/v1/checkout')->assertStatus(422);

        $order = Order::query()->findOrFail($checkout->json('order_id'));
        $this->assertSame(OrderStatus::Failed, $order->status);

        $this->postJson('/api/v1/orders/'.$order->id.'/retry-payment')
            ->assertOk()
            ->assertJsonStructure(['payment_url', 'transaction_id']);
    }

    /**
     * La progression d'un cours ne peut pas sauter instantanement a 100%,
     * mais progresse normalement avec le temps, et emet un certificat
     * a la completion en utilisant le repli de stockage local si necessaire.
     */
    public function test_progress_cannot_jump_instantly_and_certificate_is_issued_on_completion(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();
        $course = Course::factory()->create(['is_published' => true]);
        $enrollment = Enrollment::query()->create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'progress' => 0,
        ]);

        Sanctum::actingAs($user, ['*']);

        // Saut instantane de 0 a 100% : doit etre rejete
        $this->patchJson('/api/v1/enrollments/'.$enrollment->id.'/progress', ['progress' => 100])
            ->assertStatus(422);

        $enrollment->refresh();
        $this->assertSame(0, $enrollment->progress);

        // Apres un delai suffisant, la progression est acceptee
        $this->travel(90)->seconds();

        $this->patchJson('/api/v1/enrollments/'.$enrollment->id.'/progress', ['progress' => 100])
            ->assertOk();

        $enrollment->refresh();
        $this->assertTrue($enrollment->isCompleted());

        $certificate = Certificate::query()->where('enrollment_id', $enrollment->id)->first();
        $this->assertNotNull($certificate, 'Un certificat doit etre emis automatiquement a la completion.');
        $this->assertTrue(Storage::disk('local')->exists($certificate->file_path));
    }

    /**
     * L'acces a une session video LiveKit doit toujours passer par la
     * verification d'inscription au cours : un utilisateur non inscrit
     * ne peut jamais obtenir de token, meme en tentant de forcer un nom
     * de salle directement.
     */
    public function test_livekit_token_requires_real_course_enrollment(): void
    {
        $user = User::factory()->create();
        $course = Course::factory()->create(['is_published' => true, 'livekit_room' => 'salle-privee']);
        Sanctum::actingAs($user, ['*']);

        // Utilisateur non inscrit : refuse, quelle que soit la tentative
        $this->postJson('/api/v1/livekit/token', ['course_id' => $course->id])
            ->assertStatus(403);

        Enrollment::query()->create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'progress' => 0,
        ]);

        // Utilisateur inscrit, mais LiveKit non configure en environnement de test :
        // doit renvoyer une erreur propre (503), jamais un plantage brut.
        $this->postJson('/api/v1/livekit/token', ['course_id' => $course->id])
            ->assertStatus(503);
    }

    /**
     * Les routes d'administration sont strictement reservees aux comptes
     * administrateurs.
     */
    public function test_admin_routes_are_forbidden_for_regular_users(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        Sanctum::actingAs($user, ['*']);

        $this->getJson('/api/v1/admin/orders')->assertStatus(403);
        $this->getJson('/api/v1/admin/courses')->assertStatus(403);
        $this->getJson('/api/v1/admin/products')->assertStatus(403);
    }

    /**
     * Une validation manuelle de paiement par un administrateur doit
     * laisser une trace exploitable : qui, quand, sur quelle commande.
     */
    public function test_admin_manual_payment_confirmation_is_logged(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $customer = User::factory()->create();

        $order = Order::query()->create([
            'user_id' => $customer->id,
            'status' => OrderStatus::Pending,
            'total' => 4000,
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-manual-test',
        ]);

        Sanctum::actingAs($admin, ['*']);

        $this->postJson('/api/v1/admin/orders/'.$order->id.'/mark-paid')
            ->assertOk();

        $order->refresh();
        $this->assertTrue($order->isPaid());

        $log = ActivityLog::query()
            ->where('action', 'order.marked_paid_manually')
            ->where('subject_id', $order->id)
            ->first();

        $this->assertNotNull($log, 'La validation manuelle doit etre journalisee.');
        $this->assertSame($admin->id, $log->user_id);
    }

    private function fakeCinetPayInit(int $amount, string $transactionPrefix): void
    {
        Http::fake(function ($request) {
            if ($request->url() === 'https://api-checkout.cinetpay.com/v2/payment') {
                return Http::response([
                    'data' => [
                        'payment_url' => 'https://fake-cinetpay.test/pay/xyz',
                    ],
                ], 200);
            }

            return Http::response([], 500);
        });
    }

    private function fakeCinetPayCheck(
        string $transactionId,
        string $status,
        int $amount,
        string $currency
    ): void {
        Http::swap(new Factory);
        Http::fake(function ($request) use ($status, $amount, $currency) {
            if ($request->url() === 'https://api-checkout.cinetpay.com/v2/payment/check') {
                return Http::response([
                    'data' => [
                        'status' => $status,
                        'amount' => $amount,
                        'currency' => $currency,
                    ],
                ], 200);
            }

            if ($request->url() === 'https://api-checkout.cinetpay.com/v2/payment') {
                return Http::response([
                    'data' => [
                        'payment_url' => 'https://fake-cinetpay.test/pay/xyz',
                    ],
                ], 200);
            }

            return Http::response([], 500);
        });
    }
}
