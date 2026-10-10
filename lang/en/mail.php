<?php

return [
    'paid' => [
        'subject' => "Your order :ref is confirmed",
        'greeting' => 'Hello,',
        'intro' => 'Your payment has been confirmed. Here is your summary:',
        'item' => 'Item',
        'delivery' => 'Delivery to: :address',
        'pickup' => 'Pickup in store.',
        'total' => 'Total: :amount',
        'action' => 'View my orders',
        'action_guest' => 'Track my order',
        'reference' => 'Order reference: :ref',
        'thanks' => 'Thank you for your trust.',
    ],
    'confirm' => [
        'keep_ref' => "Keep this reference: it lets you track your order without an account.",
        'next_title' => "What happens next?",
        'next_delivery' => "We prepare your order, then ship it. You will receive an email at each step.",
        'next_pickup' => "We prepare your order. You will be notified by email as soon as it is ready for pickup.",
        'next_prep' => "Estimated preparation time: :days day(s).",
        'pickup_place' => "Pickup location: :place",
        'pickup_hours' => "Opening hours: :hours",
        'pickup_requirements' => "Please bring: :what",
        'fallback_link' => "If the button does not work, copy this link into your browser: :url",
        'private_link' => "This link is personal: please do not share it.",
        'invoice' => "Your invoice is attached to this email.",
        'create_account' => "Tip: create an account with this email address to find all your orders in one place.",
        'help' => "Questions? Contact us: :contact. Please quote your reference :ref.",
    ],

    'guest' => [
        'subject' => 'Your access to UNIX',
        'greeting' => 'Hello,',
        'intro' => 'An account has been created for you to access your course. Set your password to log in.',
        'action' => 'Set my password',
        'expire' => 'This link expires after a while. If you did not make this purchase, ignore this message.',
    ],
];