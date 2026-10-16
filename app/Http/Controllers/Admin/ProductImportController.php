<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\ProductImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductImportController extends Controller
{
    public function import(Request $request, ProductImporter $importer): JsonResponse
    {
        $this->authorize('create', Product::class);

        $request->validate([
            'file' => ['required', 'file', 'max:5120'],
            'dry_run' => ['nullable', 'boolean'],
            'publish' => ['nullable', 'boolean'],
        ]);

        $file = $request->file('file');
        $ext = strtolower((string) $file->getClientOriginalExtension());
        if (! in_array($ext, ['xlsx', 'csv', 'txt'], true)) {
            throw ValidationException::withMessages(['file' => 'Format non supporte : utilisez .xlsx ou .csv (pas .xls).']);
        }

        @set_time_limit(180);

        try {
            $report = $importer->run(
                $file->getRealPath(),
                $ext,
                $request->boolean('dry_run'),
                $request->boolean('publish'),
                $request->user(),
            );
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        return response()->json(['data' => $report]);
    }

    public function template(): StreamedResponse
    {
        $this->authorize('create', Product::class);

        return response()->streamDownload(function (): void {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $put = fn (array $r) => fputcsv($out, $r, ';', '"', '\\');
            $put(['nom', 'prix', 'stock', 'slug', 'categorie', 'description', 'nom_en', 'description_en', 'publie', 'image_link']);
            $put(['Exemple produit A', '15000', '20', '', '', 'Description du produit', 'Example product A', '', 'oui', '']);
            $put(['Exemple produit B', '2 500 FCFA', '5', 'produit-b', '', '', '', '', 'non', '']);
            fclose($out);
        }, 'modele-import-produits.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}