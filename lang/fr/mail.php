<?php

return [
    'paid' => [
        'subject' => 'Confirmation de votre commande n°:id',
        'greeting' => 'Bonjour,',
        'intro' => 'Votre paiement a bien été confirmé. Voici le récapitulatif :',
        'item' => 'Article',
        'delivery' => 'Livraison à : :address',
        'pickup' => 'Retrait sur place.',
        'total' => 'Total : :amount',
        'action' => 'Voir mes commandes',
        'thanks' => 'Merci pour votre confiance.',
    ],
    'guest' => [
        'subject' => 'Votre accès à UNIX',
        'greeting' => 'Bonjour,',
        'intro' => "Un compte a été créé pour vous afin d'accéder à votre formation. Définissez votre mot de passe pour vous connecter.",
        'action' => 'Définir mon mot de passe',
        'expire' => "Ce lien expire au bout d'un certain temps. Si vous n'êtes pas à l'origine de cet achat, ignorez ce message.",
    ],
];