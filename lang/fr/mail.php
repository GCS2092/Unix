<?php

return [
    'paid' => [
        'subject' => "Confirmation de votre commande :ref",
        'greeting' => 'Bonjour,',
        'intro' => 'Votre paiement a bien été confirmé. Voici le récapitulatif :',
        'item' => 'Article',
        'delivery' => 'Livraison à : :address',
        'pickup' => 'Retrait sur place.',
        'total' => 'Total : :amount',
        'action' => 'Voir mes commandes',
        'action_guest' => 'Suivre ma commande',
        'reference' => 'Identifiant de commande : :ref',
        'thanks' => 'Merci pour votre confiance.',
    ],
    'confirm' => [
        'keep_ref' => "Conservez cet identifiant : il vous permet de suivre votre commande sans compte.",
        'next_title' => "Et maintenant ?",
        'next_delivery' => "Nous pr\u{e9}parons votre commande, puis nous l'exp\u{e9}dions. Vous recevrez un e-mail \u{e0} chaque \u{e9}tape.",
        'next_pickup' => "Nous pr\u{e9}parons votre commande. Vous serez pr\u{e9}venu par e-mail d\u{e8}s qu'elle sera pr\u{ea}te \u{e0} \u{ea}tre retir\u{e9}e.",
        'next_prep' => "D\u{e9}lai de pr\u{e9}paration estim\u{e9} : :days jour(s).",
        'pickup_place' => "Lieu de retrait : :place",
        'pickup_hours' => "Horaires : :hours",
        'pickup_requirements' => "\u{c0} pr\u{e9}senter : :what",
        'fallback_link' => "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : :url",
        'private_link' => "Ce lien est personnel : ne le partagez pas.",
        'invoice' => "Votre facture est jointe \u{e0} cet e-mail.",
        'create_account' => "Astuce : cr\u{e9}ez un compte avec cette adresse e-mail pour retrouver toutes vos commandes au m\u{ea}me endroit.",
        'help' => "Une question ? Contactez-nous : :contact. Pensez \u{e0} indiquer votre identifiant :ref.",
    ],

    'guest' => [
        'subject' => 'Votre accès à UNIX',
        'greeting' => 'Bonjour,',
        'intro' => "Un compte a été créé pour vous afin d'accéder à votre formation. Définissez votre mot de passe pour vous connecter.",
        'action' => 'Définir mon mot de passe',
        'expire' => "Ce lien expire au bout d'un certain temps. Si vous n'êtes pas à l'origine de cet achat, ignorez ce message.",
    ],
];