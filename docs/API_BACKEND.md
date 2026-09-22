# API Backend (v1)

Base URL : `{APP_URL}/api/v1`

## Auth (Sanctum)

| Méthode | Route | Auth |
|---------|-------|------|
| POST | `/auth/register` | Non |
| POST | `/auth/login` | Non |
| POST | `/auth/logout` | Oui |
| GET | `/auth/me` | Oui |

Header authentifié : `Authorization: Bearer {token}`

## Catalogue (public)

| Méthode | Route |
|---------|-------|
| GET | `/catalog/courses` |
| GET | `/catalog/courses/{slug}` |
| GET | `/catalog/products` |
| GET | `/catalog/products/{slug}` |

## Panier (session)

| Méthode | Route |
|---------|-------|
| GET | `/cart` |
| POST | `/cart/items` body: `{type, id, quantity?}` |
| PATCH | `/cart/items/{type}/{id}` |
| DELETE | `/cart/items/{type}/{id}` |

## Checkout

| Méthode | Route |
|---------|-------|
| POST | `/checkout` |

## Compte connecté

| Méthode | Route |
|---------|-------|
| GET | `/orders` |
| GET | `/orders/{order}` |
| GET | `/enrollments` |
| GET | `/enrollments/{enrollment}` |
| PATCH | `/enrollments/{enrollment}/progress` |
| POST | `/enrollments/{enrollment}/complete` |
| POST | `/enrollments/{enrollment}/certificate` |
| GET | `/certificates/{certificate}/download` |
| POST | `/livekit/token` |
| GET | `/courses/{course}/playback` |

## Admin (`is_admin` + token)

| Méthode | Route |
|---------|-------|
| CRUD | `/admin/courses` |
| CRUD | `/admin/products` |
| GET | `/admin/orders` |
| GET | `/admin/orders/{order}` |
| POST | `/admin/orders/{order}/mark-paid` |

## Web (hors JSON)

| GET | `/` |
| GET | `/checkout/return` (retour paiement) |

## Webhook (inchangé)

| POST | `/api/cinetpay/notify` |
