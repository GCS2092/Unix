<?php

return [
    'cart' => [
        'already_enrolled' => 'Vous êtes déjà inscrit à ce cours.',
        'item_unavailable' => 'Cet article est indisponible.',
    ],
    'auth' => [
        'invalid_credentials' => 'Identifiants invalides.',
        'logged_out' => 'Déconnecté.',
        'reset_link_failed' => "Impossible d'envoyer le lien de réinitialisation.",
        'reset_link_sent' => "Lien de réinitialisation envoyé si l'email existe.",
        'token_invalid' => 'Jeton invalide ou expiré.',
        'password_updated' => 'Mot de passe mis à jour.',
    ],
    'order' => [
        'guest_email_required' => 'Un email est requis pour commander sans compte.',
        'insufficient_stock' => 'Stock insuffisant pour « :name ».',
        'already_enrolled_course' => 'Vous êtes déjà inscrit au cours « :title ».',
        'only_pending' => 'Seules les commandes en attente peuvent être marquées payées.',
        'payment_url_missing' => 'URL de paiement introuvable.',
        'payment_init_failed' => "La commande a été créée mais le paiement n'a pas pu être initié. Veuillez réessayer.",
        'unauthenticated' => 'Utilisateur non authentifié.',
        'not_yours' => 'Cette commande ne vous appartient pas.',
        'already_paid' => 'Cette commande est déjà payée.',
        'cannot_retry' => 'Cette commande ne peut pas être relancée.',
    ],
    'not_found' => 'Ressource introuvable.',
    'student_only' => 'Accès réservé aux étudiants.',
];