<?php

namespace App\Support\Export;

use BackedEnum;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;

final class Exporter
{
    public const MAX_ROWS = 100000;

    public function stream(ExportDefinition $def, Builder $query, string $format): void
    {
        $columns = $def->columns();
        $headers = array_keys($columns);
        $extract = array_values($columns);

        $rows = (function () use ($query, $extract, $format) {
            foreach ($query->lazyById(500) as $model) {
                yield array_map(fn (\Closure $f) => $this->cell($f($model), $format), $extract);
            }
        })();

        match ($format) {
            'csv' => $this->csv($headers, $rows),
            'xlsx' => $this->xlsx($def, $headers, $rows),
            'json' => $this->json($headers, $rows),
        };
    }

    private function csv(array $headers, iterable $rows): void
    {
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF"); // BOM : Excel lit l'UTF-8
        fputcsv($out, $headers, ';', '"', '\\');
        try {
            foreach ($rows as $r) {
                fputcsv($out, $r, ';', '"', '\\');
            }
        } catch (\Throwable $e) {
            report($e);
            fputcsv($out, ['### EXPORT INTERROMPU : fichier incomplet ###'], ';', '"', '\\');
        } finally {
            fclose($out);
        }
    }

    private function xlsx(ExportDefinition $def, array $headers, iterable $rows): void
    {
        $w = new XlsxWriter();
        $w->openToFile('php://output');
        try {
            $w->getCurrentSheet()->setName(mb_substr($def->label(), 0, 31));
            $w->addRow(Row::fromValuesWithStyle($headers, (new Style())->withFontBold(true)));
            foreach ($rows as $r) {
                $w->addRow(Row::fromValues($r));
            }
        } catch (\Throwable $e) {
            report($e);
        } finally {
            $w->close();
        }
    }

    private function json(array $headers, iterable $rows): void
    {
        echo '[';
        $first = true;
        try {
            foreach ($rows as $r) {
                echo ($first ? '' : ',').json_encode(array_combine($headers, $r), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                $first = false;
            }
        } catch (\Throwable $e) {
            report($e);
        }
        echo ']';
    }

    /** Normalise une valeur et neutralise l'injection de formules (CSV/XLSX). */
    private function cell(mixed $v, string $format): mixed
    {
        if ($v instanceof DateTimeInterface) {
            $v = $v->format('Y-m-d H:i');
        }
        if ($v instanceof BackedEnum) {
            $v = $v->value;
        }
        if ($format === 'json') {
            return $v;
        }
        if (is_bool($v)) {
            return $v ? 'oui' : 'non';
        }
        if ($v === null) {
            return '';
        }
        if (is_string($v) && $v !== '' && in_array($v[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$v;
        }

        return $v;
    }
}