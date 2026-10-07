<?php

return [
    'cart' => [
        'already_enrolled' => 'You are already enrolled in this course.',
        'item_unavailable' => 'This item is unavailable.',
    ],
    'auth' => [
        'invalid_credentials' => 'Invalid credentials.',
        'logged_out' => 'Logged out.',
        'reset_link_failed' => 'Unable to send the reset link.',
        'reset_link_sent' => 'Reset link sent if the email exists.',
        'token_invalid' => 'Invalid or expired token.',
        'password_updated' => 'Password updated.',
    ],
    'order' => [
        'guest_email_required' => 'An email is required to order without an account.',
        'insufficient_stock' => 'Insufficient stock for ":name".',
        'already_enrolled_course' => 'You are already enrolled in the course ":title".',
        'only_pending' => 'Only pending orders can be marked as paid.',
        'payment_url_missing' => 'Payment URL not found.',
        'payment_init_failed' => 'The order was created but the payment could not be started. Please try again.',
        'unauthenticated' => 'User not authenticated.',
        'not_yours' => 'This order does not belong to you.',
        'already_paid' => 'This order is already paid.',
        'cannot_retry' => 'This order cannot be retried.',
    ],
    'not_found' => 'Resource not found.',
    'student_only' => 'Access restricted to students.',
];