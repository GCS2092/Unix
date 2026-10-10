<?php

return [
    'greeting' => 'Hello,',
    'address' => 'Delivery address: :address',
    'carrier' => 'Carrier: :carrier',
    'number' => 'Tracking number: :number',
    'pickup' => 'Pickup location: :place',
    'action' => 'Track my order',
    'thanks' => 'Thank you for your trust.',
    'preparing' => [
        'subject' => 'Your order #:id is being prepared',
        'line' => 'We are preparing your order #:id. We will let you know as soon as it moves forward.',
    ],
    'shipped' => [
        'subject' => 'Your order #:id has been shipped',
        'line' => 'Good news: your order #:id is on its way.',
    ],
    'ready' => [
        'subject' => 'Your order #:id is ready for pickup',
        'line' => 'Your order #:id is ready. You can come and pick it up.',
    ],
    'delivered' => [
        'subject' => 'Your order #:id has been delivered',
        'line' => 'Your order #:id is marked as delivered. You can confirm receipt from the tracking page. If anything is wrong, please write to us.',
    ],
    'picked_up' => [
        'subject' => 'Your order #:id has been picked up',
        'line' => 'Your order #:id has been picked up. Thank you for your visit.',
    ],
];