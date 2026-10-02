<?php

namespace App\Exceptions;

class InsufficientStockException extends \RuntimeException
{
    public function __construct(string $productName)
    {
        parent::__construct(__('api.order.insufficient_stock', ['name' => $productName]));
    }
}