<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\Import\ResourceImporter;
use App\Services\Import\SheetReader;
use App\Support\Import\ImportRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ResourceImportController extends Controller
{
    private const MAX_KB = 10240;

    private function ext(Request $request): string
    {
        $ext = strtolower((string) $request->file('file')->getClientOriginalExtension());
        if (! in_array($ext, SheetReader::EXTENSIONS, true)) {
            throw ValidationException::withMessages(['file' => 'Format non supporté : utilisez .xlsx, .ods, .csv ou .json (pas .xls).']);
        }

        return $ext;
    }

    public function analyze(Request $request, string $resource, ResourceImporter $importer): JsonResponse
    {
        $def = ImportRegistry::get($resource);
        abort_if($def->scope() === 'formation' && request()->user()?->isInstructorOnly(), 403);
        $request->validate([
            'file' => ['required', 'file', 'max:'.self::MAX_KB],
            'sheet' => ['nullable', 'integer', 'min:0', 'max:200'],
            'header_line' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);
        $ext = $this->ext($request);
        @set_time_limit(120);

        try {
            $data = $importer->analyze(
                $def,
                $request->file('file')->getRealPath(),
                $ext,
                $request->filled('sheet') ? (int) $request->input('sheet') : null,
                $request->filled('header_line') ? (int) $request->input('header_line') : null,
            );
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        return response()->json(['data' => $data]);
    }

    public function import(Request $request, string $resource, ResourceImporter $importer): JsonResponse
    {
        $def = ImportRegistry::get($resource);
        abort_if($def->scope() === 'formation' && request()->user()?->isInstructorOnly(), 403);
        $request->validate([
            'file' => ['required', 'file', 'max:'.self::MAX_KB],
            'dry_run' => ['nullable', 'boolean'],
            'mode' => ['nullable', 'in:both,create,update'],
            'mapping' => ['nullable', 'string', 'max:5000'],
            'sheet' => ['nullable', 'integer', 'min:0', 'max:200'],
            'header_line' => ['nullable', 'integer', 'min:1', 'max:500'],
            'remember' => ['nullable', 'boolean'],
        ]);
        $ext = $this->ext($request);

        $mapping = null;
        if ($request->filled('mapping')) {
            $mapping = json_decode((string) $request->input('mapping'), true);
            if (! is_array($mapping)) {
                throw ValidationException::withMessages(['file' => 'Correspondance des colonnes invalide.']);
            }
        }
        if ($request->boolean('async')) {
            return app(\App\Services\Import\ImportRunService::class)->queue($request, $def->key(), $ext, (string) $request->file('file')->getRealPath(), $mapping);
        }

        @set_time_limit(300);

        $dry = $request->boolean('dry_run');
        try {
            $report = $importer->run($def, $request->file('file')->getRealPath(), $ext, $dry, $request->user(), [
                'mode' => (string) $request->input('mode', 'both'),
                'mapping' => $mapping,
                'sheet' => $request->filled('sheet') ? (int) $request->input('sheet') : null,
                'header_line' => $request->filled('header_line') ? (int) $request->input('header_line') : null,
                'remember' => $request->boolean('remember'),
            ]);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        if (! $dry) {
            try {
                app(ActivityLogger::class)->log($request->user(), 'import.'.$def->key(), null, [
                    'created' => $report['created'], 'updated' => $report['updated'], 'skipped' => $report['skipped'], 'total' => $report['total'],
                ]);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json(['data' => $report]);
    }

    public function template(string $resource): StreamedResponse
    {
        $def = ImportRegistry::get($resource);
        abort_if($def->scope() === 'formation' && request()->user()?->isInstructorOnly(), 403);
        $cols = array_filter($def->fields(), fn ($m) => empty($m['virtual']));
        $example = $def->example();

        return response()->streamDownload(function () use ($def, $cols, $example): void {
            $bold = (new Style())->withFontBold(true);
            $w = new XlsxWriter();
            $w->openToFile('php://output');
            $w->getCurrentSheet()->setName(mb_substr($def->label(), 0, 31));
            $w->addRow(Row::fromValuesWithStyle(array_values(array_column($cols, 'column')), $bold));
            $w->addRow(Row::fromValues(array_map(fn ($k) => $example[$k] ?? '', array_keys($cols))));

            $w->addNewSheetAndMakeItCurrent()->setName('Aide');
            $w->addRow(Row::fromValuesWithStyle(['Colonne', 'Obligatoire ?', 'Explication'], $bold));
            foreach ($cols as $m) {
                $w->addRow(Row::fromValues([$m['column'], ! empty($m['required']) ? 'Oui (création)' : 'Non', $m['help'] ?? '']));
            }
            $w->close();
        }, 'modele-'.$def->key().'.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }
}