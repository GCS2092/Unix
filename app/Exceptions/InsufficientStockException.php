<?php

namespace App\Exceptions;

class InsufficientStockException extends \RuntimeException
{
    public function __construct(
        public readonly string $productName,
        public readonly ?int $productId = null,
        public readonly ?int $available = null,
        public readonly ?int $requested = null,
    ) {
        parent::__construct(__('api.order.insufficient_stock', ['name' => $productName]));
    }

    /**
     * Corps JSON standard renvoyé au frontend.
     *
     * @return array<string, mixed>
     */
    public function toResponseData(): array
    {
        return [
            'message' => $this->getMessage(),
            'code' => 'insufficient_stock',
            'product' => [
                'id' => $this->productId,
                'name' => $this->productName,
                'available' => $this->available,
                'requested' => $this->requested,
            ],
        ];
    }
}
