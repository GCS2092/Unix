<?php

namespace App\Services\Import;

use OpenSpout\Reader\CSV\Options as CsvOptions;
use OpenSpout\Reader\CSV\Reader as CsvReader;
use OpenSpout\Reader\ODS\Options as OdsOptions;
use OpenSpout\Reader\ODS\Reader as OdsReader;
use OpenSpout\Reader\XLSX\Options as XlsxOptions;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use RuntimeException;
use Throwable;

/** Lit xlsx / ods / csv / txt / json de facon uniforme : feuilles puis lignes (numero => cellules). */
final class SheetReader
{
    public const EXTENSIONS = ['xlsx', 'ods', 'csv', 'txt', 'json'];

    private const CORRUPT = 'Fichier illisible ou corrompu. Réenregistrez-le en .xlsx, .ods ou .csv puis réessayez.';

    /** @return list<array{index:int,name:string}> */
    public function sheets(string $path, string $ext): array
    {
        if ($ext === 'json') {
            return [['index' => 0, 'name' => 'JSON']];
        }
        $reader = $this->make($path, $ext);
        $sheets = [];
        try {
            $reader->open($path);
            foreach ($reader->getSheetIterator() as $s) {
                $sheets[] = ['index' => $s->getIndex(), 'name' => $s->getName()];
            }
        } catch (Throwable) {
            throw new RuntimeException(self::CORRUPT);
        } finally {
            $this->close($reader);
        }
        if ($sheets === []) {
            throw new RuntimeException('Fichier vide.');
        }

        return $sheets;
    }

    /** @return \Generator<int, array<int, mixed>> */
    public function rows(string $path, string $ext, int $sheet): \Generator
    {
        if ($ext === 'json') {
            yield from $this->jsonRows($path);

            return;
        }
        $reader = $this->make($path, $ext);
        try {
            $reader->open($path);
            foreach ($reader->getSheetIterator() as $s) {
                if ($s->getIndex() !== $sheet) {
                    continue;
                }
                $line = 0;
                foreach ($s->getRowIterator() as $row) {
                    $line++;
                    yield $line => $row->toArray();
                }

                return;
            }
            throw new RuntimeException('Feuille introuvable.');
        } catch (RuntimeException $e) {
            throw $e;
        } catch (Throwable) {
            throw new RuntimeException(self::CORRUPT);
        } finally {
            $this->close($reader);
        }
    }

    /** @return \Generator<int, array<int, mixed>> */
    private function jsonRows(string $path): \Generator
    {
        try {
            $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            throw new RuntimeException('JSON invalide : le fichier ne peut pas être lu.');
        }
        if (is_array($data) && isset($data['data']) && is_array($data['data'])) {
            $data = $data['data'];
        }
        if (! is_array($data) || $data === [] || ! array_is_list($data) || ! is_array($data[0] ?? null)) {
            throw new RuntimeException('JSON : un tableau d\'objets est attendu, par exemple [{"nom":"A","prix":10}].');
        }
        $headers = [];
        foreach ($data as $row) {
            if (is_array($row)) {
                foreach (array_keys($row) as $k) {
                    $headers[(string) $k] = true;
                }
            }
        }
        $headers = array_keys($headers);
        yield 1 => $headers;
        foreach ($data as $i => $row) {
            $cells = [];
            foreach ($headers as $h) {
                $v = is_array($row) ? ($row[$h] ?? null) : null;
                $cells[] = is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : $v;
            }
            yield $i + 2 => $cells;
        }
    }

    private function make(string $path, string $ext): object
    {
        if (in_array($ext, ['csv', 'txt'], true)) {
            $head = (string) file_get_contents($path, false, null, 0, 65536);
            $lines = array_slice((array) preg_split('/\r\n|\r|\n/', $head), 0, 10);
            $sample = implode("\n", $lines);
            $delims = [';' => substr_count($sample, ';'), ',' => substr_count($sample, ','), "\t" => substr_count($sample, "\t"), '|' => substr_count($sample, '|')];
            arsort($delims);
            $delimiter = (string) array_key_first($delims);
            $chunk = strlen($head) >= 65536 ? substr($head, 0, (int) strrpos($head, "\n")) : $head;
            $encoding = ($chunk !== '' && ! mb_check_encoding($chunk, 'UTF-8')) ? 'Windows-1252' : 'UTF-8';

            return new CsvReader(new CsvOptions(FIELD_DELIMITER: $delimiter, ENCODING: $encoding));
        }
        if ($ext === 'ods') {
            return new OdsReader(new OdsOptions(SHOULD_PRESERVE_EMPTY_ROWS: true));
        }

        return new XlsxReader(new XlsxOptions(SHOULD_PRESERVE_EMPTY_ROWS: true));
    }

    private function close(object $reader): void
    {
        try {
            $reader->close();
        } catch (Throwable) {
        }
    }
}