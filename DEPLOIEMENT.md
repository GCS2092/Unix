# Deploiement : Render (API) + Vercel (site) + Cloudflare R2 (images) + Gmail (e-mails)

Ordre conseille : 1) R2, 2) Gmail, 3) Render, 4) Vercel, 5) tests.
Ne jamais mettre une cle dans git : elles se collent dans les tableaux de bord (Render, Vercel) ou dans le .env local.

## 1. Cloudflare R2 (images des pages de presentation et des formations)
1. Cloudflare > R2 > Create bucket (par exemple unix-media).
2. R2 > Manage API tokens > Create API token, droit "Object Read & Write", limite a ce bucket.
3. Noter : Access Key ID, Secret Access Key et l'adresse https://<ID_COMPTE>.r2.cloudflarestorage.com.
4. Variables a coller dans Render (noms lus dans config/filesystems.php) :
   FILESYSTEM_DISK=r2
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET=
   R2_ENDPOINT=https://<ID_COMPTE>.r2.cloudflarestorage.com
   (sans ces quatre cles, les images retombent sur le disque local, efface a chaque redeploiement)
5. Le bucket peut rester prive : l'API sert elle-meme les images.
6. Les images deja envoyees en local ne sont pas copiees sur R2 : les renvoyer depuis l'admin.

## 2. Gmail (e-mails de verification et de decision)
1. Compte Google > Securite > activer la validation en 2 etapes.
2. myaccount.google.com/apppasswords > creer un mot de passe "UNIX" > copier les 16 caracteres, sans espaces.
3. Variables :
   MAIL_MAILER=smtp
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USERNAME=<ton adresse Gmail>
   MAIL_PASSWORD=<mot de passe d'application>
   MAIL_FROM_ADDRESS=<la meme adresse Gmail>
   MAIL_FROM_NAME=UNIX
4. ATTENTION : Render bloque le SMTP (ports 25, 465, 587) sur les services gratuits. Gmail demande une instance payante.
   Sinon, utiliser un service d'envoi par API HTTPS.
5. Gmail limite les envois quotidiens (environ 500 pour un compte gratuit) : suffisant pour demarrer.

## 3. Render (API Laravel)
Variables : APP_ENV=production, APP_DEBUG=false, APP_KEY (php artisan key:generate --show),
APP_URL=https://<ton-site>.vercel.app (adresse PUBLIQUE : Vercel relaie /api vers Render), FRONTEND_URL=la meme adresse, SANCTUM_STATEFUL_DOMAINS=<ton-site>.vercel.app, SESSION_SECURE_COOKIE=true,
base de donnees, puis les cles R2 et Gmail ci-dessus.
APP_URL doit etre exacte : elle sert aux liens des e-mails et aux adresses des images.
CORS : inutile tant que Vercel relaie l'API (meme origine). Sinon, CORS_ALLOWED_ORIGINS=https://<ton-site>.vercel.app.
Render n'a pas de runtime PHP : le Dockerfile a la racine construit l'API (docker/start.sh lance les migrations, puis Apache sur le port de Render).
Base de donnees : DB_CONNECTION=pgsql et DB_URL=<Internal Database URL de la base PostgreSQL Render>. Verifier les limites du plan gratuit de la base.
Creer le service Render en choisissant Docker, branche a deployer = celle qui contient ces fichiers.

## 4. Vercel (site React)
Root Directory : frontend. Build : npm run build. Sortie : dist.
frontend/vercel.json relaie /api, /sanctum, /storage et /p vers Render, puis renvoie le reste vers index.html. Remplacer REMPLACE-API.onrender.com par l'adresse du service Render (sans https://), puis redeployer.
Variables (Vite les integre a la construction : redeployer apres chaque changement) :
   VITE_WHATSAPP_NUMBER=
VITE_WHATSAPP_NUMBER : numero international sans + ni espaces.

## 5. Tests apres deploiement
- /decouvrir ouvert directement dans un nouvel onglet (pas de 404).
- Inscription a une formation : l'e-mail de verification arrive.
- Image envoyee depuis Systeme > Pages de presentation : elle s'affiche et reste apres un redeploiement.
- Bouton WhatsApp present sur la boutique.

## 6. Avant de passer au plan payant de Render
- Sur Render gratuit : MAIL_MAILER=log. Rien n'est envoye (verification, decision, certificats, mot de passe oublie) ; les liens sont dans les journaux Render.
  Ne pas ouvrir le site au public dans cet etat : le mot de passe oublie ne fonctionnerait pas.
- Valider Gmail avant de payer, en local : creer le mot de passe d'application, le mettre dans le .env local, puis php artisan mail:test <adresse>.
- Le jour du passage au plan payant : MAIL_MAILER=smtp, MAIL_HOST=smtp.gmail.com, MAIL_PORT=587, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS (la meme adresse Gmail), redeployer, puis tester une inscription.
- En local, remettre MAIL_MAILER=log une fois les essais finis, pour ne pas envoyer de vrais e-mails pendant le developpement.