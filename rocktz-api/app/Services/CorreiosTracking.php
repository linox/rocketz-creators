<?php

namespace App\Services;

use App\Enums\BarterShipmentStatus;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class CorreiosTracking
{
    /**
     * Consulta apenas o endpoint de rastreio. Histórico e webhooks desse
     * serviço são compartilhados entre todos os visitantes e não devem ser usados.
     *
     * @return array{
     *     status: BarterShipmentStatus,
     *     status_label: ?string,
     *     service_label: ?string,
     *     events: list<array<string, mixed>>,
     *     days_in_transit: ?int,
     *     posted_at: ?Carbon,
     *     delivered_at: ?Carbon,
     *     last_error: null
     * }
     */
    public function lookup(string $code): array
    {
        $base = rtrim((string) config('services.correios.tracking_url'), '/');

        try {
            $response = Http::acceptJson()
                ->timeout(15)
                ->connectTimeout(5)
                ->withUserAgent('RocketzCreators/1.0')
                ->get($base.'/api/v1/rastreio/'.rawurlencode($code));
        } catch (ConnectionException $exception) {
            throw new CorreiosTrackingException('unavailable', previous: $exception);
        }

        if (! $response->successful()) {
            throw new CorreiosTrackingException('unavailable');
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new CorreiosTrackingException('unavailable');
        }

        $remote = strtoupper((string) ($payload['status'] ?? ''));
        $delivered = (bool) ($payload['entregue'] ?? false) || $remote === 'ENTREGUE';
        $days = $payload['diasEmTransito'] ?? null;

        return [
            'status' => $this->mapStatus($remote, $delivered),
            'status_label' => $this->clip($payload['descricaoStatus'] ?? null, 180),
            'service_label' => $this->clip($payload['servico']['descricao'] ?? null, 80),
            'events' => $this->events(is_array($payload['eventos'] ?? null) ? $payload['eventos'] : []),
            'days_in_transit' => is_numeric($days) ? max(0, min(65535, (int) $days)) : null,
            'posted_at' => $this->moment($payload['dataPostagem'] ?? null),
            'delivered_at' => $delivered ? $this->moment($payload['dataEntrega'] ?? $payload['ultimoEvento']['data'] ?? null) : null,
            'last_error' => null,
        ];
    }

    private function mapStatus(string $remote, bool $delivered): BarterShipmentStatus
    {
        if ($delivered) {
            return BarterShipmentStatus::Delivered;
        }

        return match ($remote) {
            'EM_TRANSITO' => BarterShipmentStatus::InTransit,
            'POSTADO' => BarterShipmentStatus::Posted,
            'SAIU_ENTREGA' => BarterShipmentStatus::OutForDelivery,
            'AGUARDANDO_RETIRADA' => BarterShipmentStatus::AwaitingPickup,
            'DEVOLVIDO' => BarterShipmentStatus::Returned,
            'TRIBUTADO', 'FISCALIZACAO', 'EXTRAVIADO' => BarterShipmentStatus::Issue,
            'NAO_ENCONTRADO' => BarterShipmentStatus::NotFound,
            default => BarterShipmentStatus::Other,
        };
    }

    /**
     * @param  list<mixed>  $events
     * @return list<array<string, mixed>>
     */
    private function events(array $events): array
    {
        $rows = [];
        foreach (array_slice($events, 0, 40) as $event) {
            if (! is_array($event)) {
                continue;
            }
            $status = $this->clip($event['status'] ?? null, 180);
            if ($status === null) {
                continue;
            }
            $rows[] = [
                'occurred_at' => $this->moment($event['data'] ?? null)?->toIso8601String(),
                'status' => $status,
                'category' => $this->clip($event['categoria'] ?? null, 40),
                'details' => $this->clip($event['detalhes'] ?? null, 240),
                'origin' => $this->clip($event['origem'] ?? $event['local'] ?? null, 180),
                'destination' => $this->clip($event['destino'] ?? null, 180),
            ];
        }

        return $rows;
    }

    private function moment(mixed $value): ?Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function clip(mixed $value, int $limit): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $text = trim($value);

        return $text === '' ? null : Str::limit($text, $limit, '');
    }
}
