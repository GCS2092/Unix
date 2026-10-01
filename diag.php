<?php
$id = $argv[1] ?? null;
$o = $id ? App\Models\Order::find($id) : App\Models\Order::latest('id')->first();
echo "Commande testee : #{$o->id}\n";
echo "company  : " . json_encode(config('invoice')) . "\n";
echo "items    : " . $o->items()->count() . "\n";
try {
    $pdf = app(App\Services\InvoiceService::class)->output($o);
    echo "PDF OK (" . strlen($pdf) . " octets)\n";
} catch (Throwable $e) {
    echo "ERREUR : " . get_class($e) . "\n" . $e->getMessage() . "\n";
    $prev = $e->getPrevious() ?: $e;
    echo "Origine : " . $prev->getFile() . ":" . $prev->getLine() . "\n";
    $f = $prev->getFile();
    if (is_file($f)) {
        $lines = file($f);
        for ($i = max(0, $prev->getLine() - 4); $i < min(count($lines), $prev->getLine() + 2); $i++) {
            echo ($i + 1) . ": " . $lines[$i];
        }
    }
}
