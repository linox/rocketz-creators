<?php

namespace App\Support;

use App\Enums\ApplicationStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Creator;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ShippingLabelExport
{
    /**
     * @return Collection<int, CampaignCreator>
     */
    public static function approved(Campaign $campaign): Collection
    {
        return $campaign->campaignCreators()
            ->where('application_status', ApplicationStatus::Approved)
            ->with(['creator.user'])
            ->orderBy('id')
            ->get();
    }

    /**
     * @param  Collection<int, CampaignCreator>  $rows
     */
    public static function csv(Campaign $campaign, Collection $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            return '';
        }

        fwrite($handle, "\xEF\xBB\xBF");
        $headers = [
            'campaign', 'sender_name', 'sender_phone', 'sender_country', 'sender_zip', 'sender_street', 'sender_number',
            'sender_complement', 'sender_neighborhood', 'sender_city', 'sender_state',
            'recipient_name', 'recipient_handle', 'recipient_email', 'recipient_whatsapp',
            'recipient_country', 'recipient_zip', 'recipient_street', 'recipient_number',
            'recipient_complement', 'recipient_neighborhood', 'recipient_city', 'recipient_state',
        ];
        fputcsv($handle, array_map(fn (string $key) => __('shipping.csv.'.$key), $headers), ';');

        $sender = is_array($campaign->sender_address) ? $campaign->sender_address : [];
        foreach ($rows as $row) {
            $creator = $row->creator;
            $address = is_array($creator?->shipping_address) ? $creator->shipping_address : [];
            $country = self::countryOf($address, $creator?->countryCode() ?? 'BR');
            fputcsv($handle, [
                self::cell($campaign->name),
                self::cell($campaign->sender_name),
                self::cell($campaign->sender_phone),
                self::cell($sender['country'] ?? ''),
                self::cell(ShippingAddress::formatZip((string) ($sender['country'] ?? 'BR'), $sender['zip'] ?? '')),
                self::cell($sender['street'] ?? ''),
                self::cell($sender['number'] ?? ''),
                self::cell($sender['complement'] ?? ''),
                self::cell($sender['neighborhood'] ?? ''),
                self::cell($sender['city'] ?? ''),
                self::cell($sender['state'] ?? ''),
                self::cell($creator?->full_name),
                self::cell($creator?->artistic_name),
                self::cell($creator?->user?->email),
                self::cell($creator?->whatsapp),
                self::cell($country),
                self::cell(ShippingAddress::formatZip($country, $address['zip'] ?? '')),
                self::cell($address['street'] ?? ''),
                self::cell($address['number'] ?? ''),
                self::cell($address['complement'] ?? ''),
                self::cell($address['neighborhood'] ?? ''),
                self::cell($address['city'] ?? ''),
                self::cell($address['state'] ?? ''),
            ], ';');
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv === false ? '' : $csv;
    }

    /**
     * @param  Collection<int, CampaignCreator>  $rows
     */
    public static function pdf(Campaign $campaign, Collection $rows): string
    {
        $labels = [];
        foreach ($rows as $row) {
            $creator = $row->creator;
            if (! $creator instanceof Creator) {
                continue;
            }
            if (! ShippingAddress::isComplete($creator->shipping_address, $creator->countryCode())) {
                continue;
            }
            $labels[] = [
                'kicker' => __('shipping.label_title'),
                'campaign' => (string) $campaign->name,
                'sections' => [
                    [
                        'title' => __('shipping.label_sender'),
                        'lines' => self::senderLines($campaign),
                    ],
                    [
                        'title' => __('shipping.label_recipient'),
                        'lines' => self::recipientLines($creator),
                    ],
                ],
            ];
        }

        return LabelPdf::render($labels);
    }

    public static function filename(Campaign $campaign, string $extension): string
    {
        $slug = Str::slug((string) $campaign->name) ?: 'campanha';

        return 'etiquetas-'.$slug.'.'.$extension;
    }

    /**
     * @return list<string>
     */
    private static function senderLines(Campaign $campaign): array
    {
        $address = is_array($campaign->sender_address) ? $campaign->sender_address : [];
        $lines = array_filter([
            trim((string) $campaign->sender_name),
            filled($campaign->sender_phone) ? __('shipping.phone_line', ['phone' => $campaign->sender_phone]) : null,
        ]);

        return array_values([...$lines, ...self::addressLines($address, 'BR')]);
    }

    /**
     * @return list<string>
     */
    private static function recipientLines(Creator $creator): array
    {
        $address = is_array($creator->shipping_address) ? $creator->shipping_address : [];
        $handle = trim((string) $creator->artistic_name);
        $lines = array_filter([
            trim((string) $creator->full_name),
            $handle !== '' ? __('shipping.handle_line', ['handle' => ltrim($handle, '@')]) : null,
            filled($creator->whatsapp) ? __('shipping.whatsapp_line', ['phone' => $creator->whatsapp]) : null,
        ]);

        return array_values([...$lines, ...self::addressLines($address, $creator->countryCode())]);
    }

    /**
     * @param  array<string, mixed>  $address
     * @return list<string>
     */
    private static function addressLines(array $address, string $fallbackCountry): array
    {
        $country = self::countryOf($address, $fallbackCountry);
        $street = trim(implode(', ', array_filter([
            trim((string) ($address['street'] ?? '')),
            trim((string) ($address['number'] ?? '')),
        ])));
        $city = trim(implode(' - ', array_filter([
            trim((string) ($address['city'] ?? '')),
            trim((string) ($address['state'] ?? '')),
        ])));
        $zipCity = trim(implode('  ', array_filter([
            ShippingAddress::formatZip($country, $address['zip'] ?? ''),
            $city,
        ])));

        return array_values(array_filter([
            $street,
            trim((string) ($address['complement'] ?? '')),
            trim((string) ($address['neighborhood'] ?? '')),
            $zipCity,
            $country !== 'BR' ? $country : '',
        ], fn (string $line) => $line !== ''));
    }

    /**
     * @param  array<string, mixed>  $address
     */
    private static function countryOf(array $address, string $fallbackCountry): string
    {
        $country = Geo::isValidCountry($address['country'] ?? null)
            ? Geo::normalizeCountry($address['country'])
            : Geo::normalizeCountry($fallbackCountry);

        return Geo::isValidCountry($country) ? $country : Geo::DEFAULT_COUNTRY;
    }

    private static function cell(mixed $value): string
    {
        $text = trim((string) $value);
        if ($text !== '' && preg_match('/^[=@\t\r]/', $text) === 1) {
            return "'".$text;
        }

        return $text;
    }
}
