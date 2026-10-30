<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Import\AiColumnMapper;
use App\Services\ProductImporter;
use App\Support\Import\ImportRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class AiMapController extends Controller
{
    public function suggest(Request $request, AiColumnMapper $mapper): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'string', 'max:40'],
            'columns' => ['required', 'array', 'min:1', 'max:60'],
            'columns.*.index' => ['required', 'integer', 'min:0', 'max:500'],
            'columns.*.header' => ['nullable', 'string', 'max:300'],
            'columns.*.samples' => ['nullable', 'array', 'max:5'],
            'columns.*.samples.*' => ['nullable', 'string', 'max:500'],
        ]);

        if ($data['kind'] === 'product') {
            $scope = 'shop';
            $fields = ProductImporter::FIELDS;
        } else {
            $def = ImportRegistry::get($data['kind']);
            $scope = $def->scope();
            $fields = [];
            foreach ($def->fields() as $k => $m) {
                $fields[$k] = $m['label'].(isset($m['help']) ? ' - '.$m['help'] : '');
            }
        }

        $u = $request->user();
        $own = $u->admin_scope ?? 'super';
        abort_unless($own === 'super' || $own === $scope, 403);

        try {
            $suggestions = $mapper->suggest($data['columns'], $fields);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        return response()->json(['data' => ['suggestions' => $suggestions]]);
    }
}