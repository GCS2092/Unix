<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Services\ProductImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Options as XlsxOptions;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductImportController extends Controller
{
    private function extensionOf(Request $request): string
    {
        $ext = strtolower((string) $request->file('file')->getClientOriginalExtension());
        if (! in_array($ext, ['xlsx', 'ods', 'csv', 'txt', 'json'], true)) {
            throw ValidationException::withMessages(['file' => 'Format non supporte : utilisez .xlsx, .ods, .csv ou .json (pas .xls).']);
        }

        return $ext;
    }

    /** Convertit un JSON (tableau d'objets) en .xlsx temporaire pour le lecteur existant. @return array{0:string,1:string} */
    private function jsonToXlsx(string $path): array
    {
        $tmp = (string) tempnam(sys_get_temp_dir(), 'pjs');
        register_shutdown_function(static fn () => @unlink($tmp));
        try {
            $w = new XlsxWriter();
            $w->openToFile($tmp);
            foreach ((new \App\Services\Import\SheetReader())->rows($path, 'json', 0) as $cells) {
                $w->addRow(Row::fromValues(array_map(
                    fn ($v) => is_scalar($v) || $v === null ? $v : json_encode($v, JSON_UNESCAPED_UNICODE),
                    $cells
                )));
            }
            $w->close();
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        return [$tmp, 'xlsx'];
    }

    public function analyze(Request $request, ProductImporter $importer): JsonResponse
    {
        $this->authorize('create', Product::class);

        $request->validate([
            'file' => ['required', 'file', 'max:5120'],
            'sheet' => ['nullable', 'integer', 'min:0', 'max:200'],
            'header_line' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);
        $ext = $this->extensionOf($request);
        $src = $request->file('file')->getRealPath();
        if ($ext === 'json') {
            [$src, $ext] = $this->jsonToXlsx((string) $src);
        }

        @set_time_limit(120);

        try {
            $data = $importer->analyze(
                $src,
                $ext,
                $request->filled('sheet') ? (int) $request->input('sheet') : null,
                $request->filled('header_line') ? (int) $request->input('header_line') : null,
            );
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        return response()->json(['data' => $data]);
    }

    public function import(Request $request, ProductImporter $importer): JsonResponse
    {
        $this->authorize('create', Product::class);

        $request->validate([
            'file' => ['required', 'file', 'max:5120'],
            'dry_run' => ['nullable', 'boolean'],
            'publish' => ['nullable', 'boolean'],
            'mode' => ['nullable', 'in:both,create,update'],
            'keep_stock' => ['nullable', 'boolean'],
            'create_categories' => ['nullable', 'boolean'],
            'mapping' => ['nullable', 'string', 'max:5000'],
            'sheet' => ['nullable', 'integer', 'min:0', 'max:200'],
            'header_line' => ['nullable', 'integer', 'min:1', 'max:500'],
            'remember' => ['nullable', 'boolean'],
        ]);
        $ext = $this->extensionOf($request);
        $src = $request->file('file')->getRealPath();
        if ($ext === 'json') {
            [$src, $ext] = $this->jsonToXlsx((string) $src);
        }

        $mapping = null;
        if ($request->filled('mapping')) {
            $decoded = json_decode((string) $request->input('mapping'), true);
            if (! is_array($decoded)) {
                throw ValidationException::withMessages(['file' => 'Correspondance des colonnes invalide.']);
            }
            $mapping = $decoded;
        }

        if ($request->boolean('async')) {
            return app(\App\Services\Import\ImportRunService::class)->queue($request, 'product', $ext, (string) ($src ?? $request->file('file')->getRealPath()), $mapping);
        }

        @set_time_limit(180);

        try {
            $report = $importer->run(
                $src,
                $ext,
                $request->boolean('dry_run'),
                $request->boolean('publish'),
                $request->user(),
                [
                    'mode' => (string) $request->input('mode', 'both'),
                    'keep_stock' => $request->boolean('keep_stock'),
                    'create_categories' => $request->boolean('create_categories'),
                    'mapping' => $mapping,
                    'sheet' => $request->filled('sheet') ? (int) $request->input('sheet') : null,
                    'header_line' => $request->filled('header_line') ? (int) $request->input('header_line') : null,
                    'remember' => $request->boolean('remember'),
                ],
            );
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        return response()->json(['data' => $report]);
    }

    public function template(): StreamedResponse
    {
        $this->authorize('create', Product::class);

        $cats = Category::query()->orderBy('name')->pluck('name')->all();

        return response()->streamDownload(function () use ($cats): void {
            $options = new XlsxOptions();
            if (method_exists($options, 'setColumnWidth')) {
                $options->setColumnWidth(26, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
            }
            $writer = new XlsxWriter($options);
            $writer->openToFile('php://output');

            try {
                $bold = new Style(fontBold: true);
            } catch (\Throwable) {
                $bold = null;
            }

            $writer->getCurrentSheet()->setName('Produits');
            $writer->addRow(Row::fromValuesWithStyle(['nom', 'prix', 'stock', 'slug', 'categorie', 'description', 'nom_en', 'description_en', 'publie', 'image_link'], $bold));
            $writer->addRow(Row::fromValues(['Exemple produit A', 15000, 20, '', $cats[0] ?? '', 'Description du produit', 'Example product A', '', 'oui', '']));
            $writer->addRow(Row::fromValues(['Exemple produit B', 2500, 5, 'produit-b', '', '', '', '', 'non', '']));

            $writer->addNewSheetAndMakeItCurrent()->setName('Aide');
            $help = [
                ['Colonne', 'Obligatoire ?', 'Explication'],
                ['nom', 'Oui (creation)', 'Nom du produit. Sert aussi a retrouver un produit existant.'],
                ['prix', 'Oui (creation)', 'Prix en FCFA, nombre entier. "15 000 FCFA" est accepte.'],
                ['stock', 'Non', 'Quantite en stock. Un mouvement de stock est enregistre.'],
                ['slug', 'Non', 'Identifiant unique du produit. Prioritaire pour retrouver un produit.'],
                ['categorie', 'Non', 'Nom d\'une categorie existante (voir la liste ci-dessous).'],
                ['description', 'Non', 'Description en francais.'],
                ['nom_en / description_en', 'Non', 'Nom et description en anglais.'],
                ['publie', 'Non', 'oui ou non. Vide = valeur choisie dans l\'ecran d\'import.'],
                ['image_link', 'Non', 'Lien http(s) vers l\'image du produit.'],
                [''],
                ['Categories existantes'],
            ];
            foreach ($help as $i => $r) {
                $writer->addRow(Row::fromValuesWithStyle($r, $i === 0 || ($r[0] ?? '') === 'Categories existantes' ? $bold : new \OpenSpout\Common\Entity\Style\Style()));
            }
            foreach ($cats as $c) {
                $writer->addRow(Row::fromValues([$c]));
            }
            if ($cats === []) {
                $writer->addRow(Row::fromValues(['(aucune categorie pour l\'instant)']));
            }

            $writer->close();
        }, 'modele-import-produits.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }
}

