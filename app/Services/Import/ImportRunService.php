<?php

namespace App\Services\Import;

use App\Jobs\RunImportJob;
use App\Models\ImportRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ImportRunService
{
    public function queue(Request $request, string $kind, string $ext, string $srcPath, ?array $mapping): JsonResponse
    {
        $uid = $request->user()?->id;

        $busy = ImportRun::query()->where('user_id', $uid)
            ->whereIn('status', ['queued', 'running'])
            ->where('created_at', '>', now()->subMinutes(35))->exists();
        if ($busy) {
            throw ValidationException::withMessages(['file' => 'Un import est déjà en cours. Attendez sa fin avant d\'en lancer un autre.']);
        }

        $rel = 'imports/'.Str::uuid().'.'.$ext;
        $h = fopen($srcPath, 'rb');
        if ($h === false) {
            throw ValidationException::withMessages(['file' => 'Fichier illisible.']);
        }
        Storage::disk('local')->put($rel, $h);
        fclose($h);

        $run = ImportRun::query()->create([
            'user_id' => $uid,
            'kind' => $kind,
            'path' => $rel,
            'ext' => $ext,
            'status' => 'queued',
            'options' => [
                'dry_run' => $request->boolean('dry_run'),
                'mode' => (string) $request->input('mode', 'both'),
                'mapping' => $mapping,
                'sheet' => $request->filled('sheet') ? (int) $request->input('sheet') : null,
                'header_line' => $request->filled('header_line') ? (int) $request->input('header_line') : null,
                'remember' => $request->boolean('remember'),
                'publish' => $request->boolean('publish'),
                'keep_stock' => $request->boolean('keep_stock'),
                'create_categories' => $request->boolean('create_categories'),
            ],
        ]);

        dispatch(new RunImportJob($run->id));

        return response()->json(['data' => ['run_id' => $run->id]], 202);
    }
}