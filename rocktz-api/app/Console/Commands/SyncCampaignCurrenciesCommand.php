<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Support\Geo;
use Illuminate\Console\Command;

class SyncCampaignCurrenciesCommand extends Command
{
    protected $signature = 'geo:sync-currencies {--from= : Moeda de origem dos valores atuais (ex: BRL). Sem isso, usa a moeda gravada na campanha}';

    protected $description = 'Converte campanhas e recorrentes para a moeda da empresa';

    public function handle(): int
    {
        $campaigns = 0;
        $contracts = 0;
        $forcedFrom = Geo::normalizeCurrency($this->option('from'));
        if ($forcedFrom !== '' && ! Geo::isValidCurrency($forcedFrom)) {
            $this->error('Moeda de origem inválida.');

            return self::FAILURE;
        }

        Company::query()
            ->with(['campaigns.campaignCreators', 'recurringContracts.recurringContractCreators'])
            ->each(function (Company $company) use (&$campaigns, &$contracts, $forcedFrom) {
                $target = $company->currencyCode();

                foreach ($company->campaigns as $campaign) {
                    $from = $forcedFrom !== ''
                        ? $forcedFrom
                        : Geo::normalizeCurrency($campaign->currency ?: Geo::DEFAULT_CURRENCY);
                    if ($from === $target) {
                        continue;
                    }

                    $campaign->fill([
                        'total_budget' => Geo::convertMoney($campaign->total_budget, $from, $target),
                        'agency_fee' => Geo::convertMoney($campaign->agency_fee, $from, $target),
                        'creators_budget' => Geo::convertMoney($campaign->creators_budget, $from, $target),
                        'creator_cache' => Geo::convertMoney($campaign->creator_cache, $from, $target),
                        'currency' => $target,
                    ])->save();

                    foreach ($campaign->campaignCreators as $row) {
                        $row->fill([
                            'amount' => Geo::convertMoney($row->amount, $from, $target),
                        ])->save();
                    }

                    $campaigns++;
                }

                foreach ($company->recurringContracts as $contract) {
                    $from = $forcedFrom !== ''
                        ? $forcedFrom
                        : Geo::normalizeCurrency($contract->currency ?: Geo::DEFAULT_CURRENCY);
                    if ($from === $target) {
                        continue;
                    }

                    $contract->fill([
                        'monthly_fee' => Geo::convertMoney($contract->monthly_fee, $from, $target),
                        'currency' => $target,
                    ])->save();

                    foreach ($contract->recurringContractCreators as $row) {
                        $row->fill([
                            'monthly_cache' => Geo::convertMoney($row->monthly_cache, $from, $target),
                            'monthly_fee' => Geo::convertMoney($row->monthly_fee, $from, $target),
                            'deliverables_fee' => Geo::convertMoney($row->deliverables_fee, $from, $target),
                        ])->save();
                    }

                    $contracts++;
                }
            });

        $this->info("Campanhas atualizadas: {$campaigns}");
        $this->info("Contratos recorrentes atualizados: {$contracts}");

        return self::SUCCESS;
    }
}
