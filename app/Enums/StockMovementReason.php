<?php

namespace App\Enums;

enum StockMovementReason: string
{
    case Reserve = 'reserve';       // commande créée
    case Release = 'release';       // paiement échoué
    case Cancel = 'cancel';         // commande annulée
    case Expire = 'expire';         // réservation expirée
    case Restock = 'restock';       // réception de marchandise
    case Damage = 'damage';         // casse / perte
    case Inventory = 'inventory';   // stock compté
    case Adjustment = 'adjustment'; // correction manuelle
    case Initial = 'initial';       // stock à la création du produit
}