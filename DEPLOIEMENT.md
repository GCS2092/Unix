# Deploiement : Render (API) + Vercel (site) + Cloudflare R2 (images) + Gmail (e-mails)

Ordre conseille : 1) R2, 2) Gmail, 3) Render, 4) Vercel, 5) tests.
Ne jamais mettre une cle dans git : elles se collent dans les tableaux de bord (Render, Vercel) ou dans le .env local.

## 1. Cloudflare R2 (images des pages de presentation et des formations)
1. Cloudflare > R2 > Create bucket (par exemple unix-media).
2. R2 > Manage API tokens > Create API token, droit "Object Read & Write", limite a ce bucket.
3. Noter : Access Key ID, Secret Access Key et l'adresse https://<ID_COMPTE>.r2.cloudflarestorage.com.
4. Variables a coller dans Render (noms lus dans config/filesystems.php) :
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   AWS_DEFAULT_REGION=
   AWS_BUCKET=
   AWS_URL=
   AWS_ENDPOINT=
   AWS_USE_PATH_STYLE_ENDPOINT=
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET=
   R2_ENDPOINT=
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
APP_URL=https://<service>.onrender.com, FRONTEND_URL=https://<projet>.vercel.app,
base de donnees, puis les cles R2 et Gmail ci-dessus.
APP_URL doit etre exacte : elle sert aux liens des e-mails et aux adresses des images.
Autoriser l'adresse Vercel dans config/cors.php si elle n'est pas deja lue depuis FRONTEND_URL.
Render n'a pas de runtime PHP : le Dockerfile a la racine construit l'API (docker/start.sh lance les migrations, puis Apache sur le port de Render).
Base de donnees : DB_CONNECTION=pgsql et DB_URL=<Internal Database URL de la base PostgreSQL Render>. Verifier les limites du plan gratuit de la base.
Creer le service Render en choisissant Docker, branche a deployer = celle qui contient ces fichiers.

## 4. Vercel (site React)
Root Directory : frontend. Build : npm run build. Sortie : dist.
frontend/vercel.json renvoie toutes les adresses vers index.html (liens directs comme /decouvrir).
Variables (Vite les integre a la construction : redeployer apres chaque changement) :
   VITE_WHATSAPP_NUMBER=
VITE_WHATSAPP_NUMBER : numero international sans + ni espaces.

## 5. Tests apres deploiement
- /decouvrir ouvert directement dans un nouvel onglet (pas de 404).
- Inscription a une formation : l'e-mail de verification arrive.
- Image envoyee depuis Systeme > Pages de presentation : elle s'affiche et reste apres un redeploiement.
- Bouton WhatsApp present sur la boutique.