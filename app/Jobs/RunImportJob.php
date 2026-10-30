<?php

namespace App\Jobs;

use App\Models\ImportRun;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\Import\ResourceImporter;
use App\Services\ProductImporter;
use App\Support\Import\ImportRegistry;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class RunImportJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;
    public int $timeout = 1800;

    public function __construct(public int $runId)
    {
    }

    public function handle(): void
    {
        $run = ImportRun::query()->find($this->runId);
        if (! $run || $run->status !== 'queued') {
            return;
        }
        @set_time_limit(1800);
        $run->update(['status' => 'running', 'started_at' => now()]);

        try {
            $o = $run->options ?? [];
            $dry = (bool) ($o['dry_run'] ?? false);
            $admin = $run->user_id ? User::query()->find($run->user_id) : null;
            $abs = Storage::disk('local')->path($run->path);
            $common = [
                'mode' => (string) ($o['mode'] ?? 'both'),
                'mapping' => $o['mapping'] ?? null,
                'sheet' => $o['sheet'] ?? null,
                'header_line' => $o['header_line'] ?? null,
                'remember' => (bool) ($o['remember'] ?? false),
            ];

            if ($run->kind === 'product') {
                $report = app(ProductImporter::class)->run($abs, $run->ext, $dry, (bool) ($o['publish'] ?? false), $admin, $common + [
                    'keep_stock' => (bool) ($o['keep_stock'] ?? false),
                    'create_categories' => (bool) ($o['create_categories'] ?? false),
                ]);
            } else {
                $report = app(ResourceImporter::class)->run(ImportRegistry::get($run->kind), $abs, $run->ext, $dry, $admin, $common);
            }

            $run->update(['status' => 'done', 'report' => $report, 'finished_at' => now()]);

            if ($admin && ! $dry) {
                try {
                    app(ActivityLogger::class)->log($admin, 'import.'.$run->kind, null, [
                        'created' => $report['created'], 'updated' => $report['updated'], 'skipped' => $report['skipped'], 'total' => $report['total'],
                    ]);
                } catch (Throwable $e) {
                    report($e);
                }
            }
        } catch (RuntimeException $e) {
            $run->update(['status' => 'failed', 'error' => $e->getMessage(), 'finished_at' => now()]);
        } catch (Throwable $e) {
            report($e);
            $run->update(['status' => 'failed', 'error' => 'Erreur inattendue pendant l\'import. Aucune donnée n\'a été perdue : réessayez ou contactez l\'administrateur.', 'finished_at' => now()]);
        } finally {
            Storage::disk('local')->delete($run->path);
        }
    }
}