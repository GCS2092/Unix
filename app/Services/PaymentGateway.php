<?php

namespace App\Services;

interface PaymentGateway
{
    /**
     * @return array<string, mixed>
     */
    public function initiatePayment(string $transactionId, int $amount, string $description, string $currency = 'XOF'): array;

    /**
     * @return array<string, mixed>
     */
    public function checkTransactionStatus(string $transactionId): array;
}