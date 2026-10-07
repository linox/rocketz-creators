<?php

namespace App\Support;

class LabelPdf
{
    private const PAGE_WIDTH = 595.28;

    private const PAGE_HEIGHT = 841.89;

    /**
     * @param  list<array{kicker: string, campaign: string, sections: list<array{title: string, lines: list<string>}>}>  $labels
     */
    public static function render(array $labels): string
    {
        $streams = [];
        foreach (array_chunk($labels, 2) as $pair) {
            $streams[] = self::page($pair);
        }

        if ($streams === []) {
            $streams[] = '';
        }

        return self::document($streams);
    }

    /**
     * @param  list<array{kicker: string, campaign: string, sections: list<array{title: string, lines: list<string>}>}>  $pair
     */
    private static function page(array $pair): string
    {
        $ops = '';
        foreach ($pair as $slot => $label) {
            [$x, $y, $w, $h] = self::slot((int) $slot);
            $ops .= self::paint($label, $x, $y, $w, $h);
        }

        if (count($pair) === 2) {
            $mid = self::PAGE_HEIGHT / 2;
            $ops .= "0.55 0.58 0.64 RG 0.6 w [3 3] 0 d\n";
            $ops .= sprintf("%.2F %.2F m %.2F %.2F l S\n", 36, $mid, self::PAGE_WIDTH - 36, $mid);
            $ops .= "[] 0 d\n";
            $ops .= self::text(self::PAGE_WIDTH / 2 - 28, $mid + 4, __('shipping.label_cut'), 7, false, [0.45, 0.48, 0.55]);
        }

        return $ops;
    }

    /**
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    private static function slot(int $slot): array
    {
        $margin = 28.0;
        $gap = 22.0;
        $height = (self::PAGE_HEIGHT - ($margin * 2) - $gap) / 2;
        $y = $slot === 0 ? self::PAGE_HEIGHT - $margin - $height : $margin;

        return [$margin, $y, self::PAGE_WIDTH - ($margin * 2), $height];
    }

    /**
     * @param  array{kicker: string, campaign: string, sections: list<array{title: string, lines: list<string>}>}  $label
     */
    private static function paint(array $label, float $x, float $y, float $w, float $h): string
    {
        $header = 30.0;
        $ops = sprintf("0.09 0.11 0.20 RG 1 w %.2F %.2F %.2F %.2F re S\n", $x, $y, $w, $h);
        $ops .= sprintf("0.09 0.11 0.20 rg %.2F %.2F %.2F %.2F re f\n", $x, $y + $h - $header, $w, $header);
        $title = self::fit(trim($label['kicker'].'  ·  '.$label['campaign']), 10, $w - 28);
        $ops .= self::text($x + 12, $y + $h - 19, $title, 10, true, [1, 1, 1]);

        $cursor = $y + $h - $header - 16;
        $floor = $y + 12;
        foreach ($label['sections'] as $section) {
            if ($cursor < $floor + 12) {
                break;
            }
            $ops .= self::text($x + 12, $cursor, $section['title'], 8, true, [0.72, 0.42, 0.05]);
            $cursor -= 14;
            foreach ($section['lines'] as $line) {
                foreach (self::wrap($line, 10, $w - 28) as $wrapped) {
                    if ($cursor < $floor) {
                        break 2;
                    }
                    $ops .= self::text($x + 12, $cursor, $wrapped, 10, false, [0.12, 0.16, 0.22]);
                    $cursor -= 13;
                }
            }
            $cursor -= 8;
        }

        $ops .= self::text($x + 12, $y + 10, 'Rocketz', 7, true, [0.45, 0.48, 0.55]);

        return $ops;
    }

    /**
     * @param  array{0: float, 1: float, 2: float}  $rgb
     */
    private static function text(float $x, float $y, string $text, float $size, bool $bold, array $rgb): string
    {
        $font = $bold ? 'F2' : 'F1';
        $encoded = self::encode($text);
        $sizeText = number_format($size, 2, '.', '');
        $xText = number_format($x, 2, '.', '');
        $yText = number_format($y, 2, '.', '');
        $red = number_format($rgb[0], 3, '.', '');
        $green = number_format($rgb[1], 3, '.', '');
        $blue = number_format($rgb[2], 3, '.', '');

        return "BT /{$font} {$sizeText} Tf {$red} {$green} {$blue} rg 1 0 0 1 {$xText} {$yText} Tm ({$encoded}) Tj ET\n";
    }

    private static function fit(string $text, float $size, float $maxWidth): string
    {
        $max = max(8, (int) floor($maxWidth / ($size * 0.52)));
        if (mb_strlen($text) <= $max) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, $max - 3)).'...';
    }

    /**
     * @return list<string>
     */
    private static function wrap(string $text, float $size, float $maxWidth): array
    {
        $text = trim(preg_replace('/\s+/', ' ', $text) ?? '');
        if ($text === '') {
            return [];
        }

        $max = max(8, (int) floor($maxWidth / ($size * 0.5)));
        $words = preg_split('/\s+/', $text) ?: [];
        $lines = [];
        $current = '';
        foreach ($words as $word) {
            $candidate = $current === '' ? $word : $current.' '.$word;
            if (mb_strlen($candidate) <= $max) {
                $current = $candidate;

                continue;
            }
            if ($current !== '') {
                $lines[] = $current;
            }
            $current = $word;
        }
        if ($current !== '') {
            $lines[] = $current;
        }

        return $lines;
    }

    private static function encode(string $text): string
    {
        $text = str_replace(["\r", "\n"], ' ', $text);
        $encoded = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
        if ($encoded === false) {
            $encoded = preg_replace('/[^\x20-\x7E]/', '', $text) ?? '';
        }

        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $encoded);
    }

    /**
     * @param  list<string>  $streams
     */
    private static function document(array $streams): string
    {
        $pageCount = count($streams);
        $fontRegular = 3 + ($pageCount * 2);
        $fontBold = $fontRegular + 1;
        $objects = [];
        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';

        $pageNumbers = [];
        $contentNumbers = [];
        $next = 3;
        for ($index = 0; $index < $pageCount; $index++) {
            $pageNumbers[] = $next++;
            $contentNumbers[] = $next++;
        }

        $kids = implode(' ', array_map(fn (int $number) => $number.' 0 R', $pageNumbers));
        $objects[2] = "<< /Type /Pages /Count {$pageCount} /Kids [{$kids}] >>";

        foreach ($streams as $index => $stream) {
            $stream = rtrim($stream)."\n";
            $pageNumber = $pageNumbers[$index];
            $contentNumber = $contentNumbers[$index];
            $objects[$pageNumber] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '.self::PAGE_WIDTH.' '.self::PAGE_HEIGHT."] /Contents {$contentNumber} 0 R /Resources << /Font << /F1 {$fontRegular} 0 R /F2 {$fontBold} 0 R >> >> >>";
            $objects[$contentNumber] = '<< /Length '.strlen($stream)." >>\nstream\n{$stream}endstream";
        }

        $objects[$fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objects[$fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        ksort($objects);

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $number => $body) {
            $offsets[$number] = strlen($pdf);
            $pdf .= "{$number} 0 obj\n{$body}\nendobj\n";
        }

        $xref = strlen($pdf);
        $size = count($objects) + 1;
        $pdf .= "xref\n0 {$size}\n";
        $pdf .= "0000000000 65535 f \n";
        for ($number = 1; $number < $size; $number++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$number]);
        }
        $pdf .= "trailer\n<< /Size {$size} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";

        return $pdf;
    }
}
