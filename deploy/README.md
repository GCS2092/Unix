# Notifications : mise en production

1. Copier les valeurs de `env.production.example` dans le `.env` du serveur (sans jamais commiter les mots de passe).
2. Installer `supervisor-unix-worker.conf` (Supervisor), puis : `supervisorctl reread && supervisorctl update`.
3. Installer `crontab.txt` (`crontab -e`).
4. Lancer `php artisan migrate` (tables jobs, failed_jobs, notifications).
5. Verifier : `php artisan notifications:check` (doit afficher "Aucun probleme bloquant").
6. A chaque deploiement : `php artisan queue:restart`.
7. Chez le fournisseur d'e-mails : configurer SPF et DKIM pour le domaine de MAIL_FROM_ADDRESS.

Echecs d'envoi : `php artisan queue:failed`, puis `php artisan queue:retry all`.
