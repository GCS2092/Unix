<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Export\Exporter;
use App\Support\Export\ExportRegistry;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    private const MIME = [
        'csv' => 'text/csv; charset=UTF-8',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'json' => 'application/json; charset=UTF-8',
    ];

    public function download(Request $request, string $resource, Exporter $exporter): StreamedResponse
    {
        $def = ExportRegistry::get($resource);

        if ($ability = $def->ability()) {
            $this->authorize($ability[0], $ability[1]);
        }

        $request->validate([
            'format' => ['required', 'in:csv,xlsx,json'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'status' => ['nullable', 'string', 'max:32'],
            'published' => ['nullable', 'in:0,1'],
        ]);
        $format = (string) $request->query('format');

        $query = $def->query($request);
        $count = (clone $query)->count();
        if ($count === 0) {
            throw ValidationException::withMessages(['format' => 'Aucune donnée à exporter avec ces filtres.']);
        }
        if ($count > Exporter::MAX_ROWS) {
            throw ValidationException::withMessages(['format' => "Trop de lignes ($count) : affinez avec les filtres de dates."]);
        }

        @set_time_limit(300);

        return response()->streamDownload(
            fn () => $exporter->stream($def, $query, $format),
            $def->filename().'.'.$format,
            ['Content-Type' => self::MIME[$format], 'Cache-Control' => 'private, no-store'],
        );
    }
}