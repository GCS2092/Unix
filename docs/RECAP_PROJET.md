# Récapitulatif du projet Unix

> Dernière mise à jour : 22 septembre 2026  
> Stack : Laravel 12 · PostgreSQL · Sanctum · CinetPay · LiveKit · Bunny Stream · Cloudflare R2

Ce document résume **ce qui est fait**, **ce qui manque** et **les prochaines étapes** pour la plateforme (visioconférence + formation + e-commerce).

---

## 1. Vue d'ensemble

| Domaine | État | Commentaire |
|---------|------|-------------|
| Backend API (JSON) | ✅ Fonctionnel | 37 routes `/api/v1` + webhook CinetPay |
| Base de données | ⚠️ Migrations prêtes | À exécuter : `php artisan migrate` |
| Intégrations externes | ⚠️ Code prêt | Clés API à configurer dans `.env` |
| Frontend (site client) | ❌ Quasi absent | Seule la page `welcome` existe |
| Back-office UI | ❌ Absent | Admin exposé en JSON uniquement |
| Tests automatisés | ⚠️ Partiel | 5 tests (auth + catalogue) |
| Déploiement | ❌ Non fait | Laravel Cloud à configurer |

---

## 2. Ce qui est fait

### 2.1 Infrastructure Laravel

- [x] Projet Laravel 12 installé et structuré
- [x] Packages installés :
  - `laravel/sanctum` (auth API par token)
  - `barryvdh/laravel-dompdf` (certificats PDF)
  - `firebase/php-jwt` (tokens LiveKit)
  - `league/flysystem-aws-s3-v3` (stockage R2/S3)
- [x] Configuration `.env.example` (PostgreSQL, CinetPay, LiveKit, Bunny, R2)
- [x] Middleware `admin` et `sanctum.optional` (panier/checkout invité ou connecté)

### 2.2 Base de données

**Migrations créées :**

| Table | Contenu principal |
|-------|-------------------|
| `users` | + champ `is_admin` |
| `orders` | user_id nullable, guest_email, status, total, payment_transaction_id |
| `order_items` | relation polymorphique vers `courses` ou `products` |
| `courses` | title, slug, price, stream_video_id, livekit_room, is_published |
| `products` | name, slug, price, stock, is_published |
| `enrollments` | user_id, course_id, progress, completed_at |
| `certificates` | enrollment_id, file_path, issued_at |
| `payment_webhook_events` | idempotence des webhooks CinetPay |
| `personal_access_tokens` | Sanctum |

**Modèles Eloquent** avec relations (`morphTo`, `hasMany`, `belongsTo`, etc.) :
`User`, `Order`, `OrderItem`, `Course`, `Product`, `Enrollment`, `Certificate`, `PaymentWebhookEvent`

**Factories** : User, Course, Product, Order, OrderItem, Enrollment, Certificate

**Seeders** :
- `DatabaseSeeder` : admin + utilisateur test + catalogue
- `CatalogSeeder` : 3 cours + 5 produits factices
- `DemoDataSeeder` : données démo (inscription, commande payée) — nécessite des slugs fixes

### 2.3 API REST (`/api/v1`)

Documentation détaillée : [`docs/API_BACKEND.md`](API_BACKEND.md)

| Module | Routes | État |
|--------|--------|------|
| Auth Sanctum | register, login, logout, me | ✅ |
| Catalogue public | courses, products (liste + détail par slug) | ✅ |
| Panier (session) | GET/POST/PATCH/DELETE cart | ✅ |
| Checkout | POST checkout → URL CinetPay | ✅ |
| Commandes | GET orders (utilisateur connecté) | ✅ |
| Inscriptions | CRUD progress, complete | ✅ |
| Certificats | émission + téléchargement PDF | ✅ |
| Lecture vidéo | playback signé Bunny Stream | ✅ |
| LiveKit | génération token JWT | ✅ |
| Admin | CRUD courses/products, liste commandes, mark-paid | ✅ |
| Webhook | POST `/api/cinetpay/notify` | ✅ |

### 2.4 Services métier

| Service | Rôle |
|---------|------|
| `CartService` | Panier en session (cours + produits mixtes) |
| `CheckoutService` | Prévisualisation et création de commande |
| `OrderFulfillmentService` | Paiement → inscriptions + décrémentation stock |
| `OrderPaymentService` | Initiation CinetPay + webhook idempotent |
| `CinetPayService` | Init paiement + vérification transaction |
| `EnrollmentService` | Progression, complétion, inscription automatique |
| `CertificateService` | Génération PDF et stockage |
| `BunnyStreamService` | URL embed vidéo signée |
| `LiveKitService` | Token JWT pour visioconférence |

### 2.5 Sécurité

- [x] Auth API via Sanctum (Bearer token)
- [x] Policies d'autorisation (Course, Product, Order, Enrollment, Certificate)
- [x] Validation paiement **uniquement via webhook** + appel `check` CinetPay
- [x] Idempotence webhooks (`payment_webhook_events`)
- [x] Liens vidéo Bunny Stream signés avec expiration
- [x] Achat invité (guest_email sur commande)
- [x] Rôle admin (`is_admin` + middleware)

### 2.6 Pages web (Blade)

| Page | Route | État |
|------|-------|------|
| Accueil | `/` | ✅ `welcome.blade.php` |
| Retour paiement | `/checkout/return` | ✅ Page informative |
| Template certificat PDF | (interne) | ✅ `certificates/course.blade.php` |

### 2.7 Tests

```
Tests\Feature\Api\AuthApiTest     → register + login
Tests\Feature\Api\CatalogApiTest  → liste cours publiés
```

**5 tests passent** (`php artisan test`).

### 2.8 Comptes de test (après seed)

| Email | Rôle | Mot de passe |
|-------|------|--------------|
| `admin@example.com` | Admin | `password` |
| `test@example.com` | Utilisateur | `password` |

---

## 3. Ce qui manque

### 3.1 Configuration / environnement

- [ ] Fichier `.env` local rempli et testé
- [ ] `php artisan migrate` exécuté sur PostgreSQL
- [ ] `php artisan db:seed` exécuté
- [ ] Compte **CinetPay** (API key, site ID) — mode TEST puis PROD
- [ ] Compte **LiveKit Cloud** (API key, secret, URL WebSocket)
- [ ] Compte **Bunny Stream** (library ID, security key)
- [ ] Bucket **Cloudflare R2** (certificats PDF, images)
- [ ] Service email transactionnel (Resend / Postmark) pour les notifications

### 3.2 Frontend (priorité haute pour l'utilisateur final)

- [ ] Page catalogue cours / produits
- [ ] Page détail cours / produit
- [ ] Interface panier
- [ ] Tunnel de checkout (invité + connecté)
- [ ] Espace membre : mes commandes, mes cours, progression
- [ ] Lecteur vidéo (embed Bunny Stream)
- [ ] Interface visioconférence (client LiveKit)
- [ ] Téléchargement certificat
- [ ] Design / charte graphique / responsive mobile

### 3.3 Back-office (interface admin)

- [ ] Dashboard admin (au-delà de l'API JSON)
- [ ] Gestion visuelle cours / produits / commandes
- [ ] Upload vidéos vers Bunny Stream depuis l'admin
- [ ] Statistiques (ventes, inscriptions)

### 3.4 Fonctionnalités backend avancées

- [ ] Upload d'images produits / couvertures cours
- [ ] Gestion des catégories / tags
- [ ] Coupons / codes promo
- [ ] Remboursements
- [ ] Export commandes (CSV)
- [ ] Rate limiting API
- [ ] Logs / monitoring (Sentry, etc.)
- [ ] File d'attente (queue) pour emails et certificats en production
- [ ] Vérification email à l'inscription
- [ ] Réinitialisation mot de passe
- [ ] Paiement international Stripe (optionnel, prévu au cahier des charges)

### 3.5 Tests

- [ ] Tests panier (add, update, remove)
- [ ] Tests checkout (invité + connecté)
- [ ] Tests webhook CinetPay (mock)
- [ ] Tests fulfillment (inscription après paiement)
- [ ] Tests certificat PDF
- [ ] Tests policies / admin
- [ ] Tests LiveKit / Bunny (mock)

### 3.6 DevOps / déploiement

- [ ] Push Git propre sur GitHub
- [ ] CI/CD (tests automatiques sur PR)
- [ ] Déploiement Laravel Cloud
- [ ] Variables d'environnement production
- [ ] Domaine + HTTPS
- [ ] Webhook CinetPay configuré en production (`notify_url`)

### 3.7 Projet / produit

- [ ] Nom définitif de la plateforme (actuellement « Unix », nom de travail)
- [ ] Vérification juridique du nom avant lancement public
- [ ] Nom de domaine
- [ ] CGV / politique de confidentialité

---

## 4. Architecture actuelle (schéma simplifié)

```
Client (navigateur / app mobile)
        │
        ▼
┌───────────────────────────────────────┐
│           Laravel (API + Web)         │
│  Storefront │ Admin │ Api │ Webhook   │
└───────────────────────────────────────┘
        │           │           │
        ▼           ▼           ▼
   PostgreSQL   Cloudflare R2   Services externes
                  (PDF, images)   ├── CinetPay (paiement)
                                  ├── Bunny Stream (VOD)
                                  └── LiveKit (visio)
```

---

## 5. Commandes utiles

```bash
# Installation
composer install
cp .env.example .env
php artisan key:generate

# Base de données
php artisan migrate
php artisan db:seed

# Lancer le serveur local
php artisan serve

# Lancer les tests
php artisan test

# Lister les routes API
php artisan route:list --path=api
```

---

## 6. Prochaines étapes recommandées (par priorité)

1. **Configurer `.env` + migrer/seed** la base PostgreSQL locale
2. **Tester le flux complet** : catalogue → panier → checkout → webhook CinetPay (sandbox)
3. **Créer le frontend** (pages catalogue, panier, espace membre)
4. **Configurer les comptes cloud** (LiveKit, Bunny, R2, CinetPay PROD)
5. **Écrire les tests manquants** (panier, checkout, webhook)
6. **Déployer sur Laravel Cloud**
7. **Construire l'interface admin** (ou utiliser un outil type Filament)

---

## 7. Fichiers de référence

| Fichier | Description |
|---------|-------------|
| [`docs/API_BACKEND.md`](API_BACKEND.md) | Documentation des endpoints API |
| [`cahier de charge/Resume_Projet.txt`](../cahier%20de%20charge/Resume_Projet.txt) | Cahier des charges résumé |
| [`.env.example`](../.env.example) | Variables d'environnement |
| [`routes/api.php`](../routes/api.php) | Définition des routes API |
| [`routes/web.php`](../routes/web.php) | Routes web (accueil, retour paiement) |

---

## 8. Notes importantes

- **Ne jamais valider un paiement** sur le seul retour navigateur (`/checkout/return`) : la confirmation réelle passe par le webhook `/api/cinetpay/notify`.
- Les **vidéos de cours** ne doivent pas être stockées sur Laravel Cloud : utiliser Bunny Stream avec liens signés.
- L'**achat invité** est supporté : `guest_email` obligatoire si pas de token Sanctum au checkout.
- Le nom **« Unix »** est un nom de travail : changement facile via `APP_NAME`, mais vérification juridique nécessaire avant lancement public.
