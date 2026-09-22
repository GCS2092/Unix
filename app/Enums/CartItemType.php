<?php

namespace App\Enums;

enum CartItemType: string
{
    case Course = 'course';
    case Product = 'product';
}
