<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
            $table->index(['company_id', 'user_id', 'read']);
        });

        DB::statement('
            UPDATE notifications
            SET company_id = (
                SELECT company_id FROM campaigns WHERE campaigns.id = notifications.campaign_id
            )
            WHERE company_id IS NULL
              AND campaign_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = notifications.campaign_id)
        ');

        DB::statement('
            UPDATE notifications
            SET company_id = (
                SELECT company_id FROM recurring_contracts WHERE recurring_contracts.id = notifications.recurring_contract_id
            )
            WHERE company_id IS NULL
              AND recurring_contract_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM recurring_contracts WHERE recurring_contracts.id = notifications.recurring_contract_id
              )
        ');

        DB::table('notifications')
            ->whereNull('company_id')
            ->where('target_role', 'company')
            ->orderBy('id')
            ->get(['id', 'user_id', 'creator_id', 'link'])
            ->each(function (object $row): void {
                $creatorId = (int) ($row->creator_id ?? 0);
                if ($creatorId < 1 && preg_match('#/creators/(\d+)#', (string) $row->link, $match)) {
                    $creatorId = (int) $match[1];
                }

                $companyId = $this->companyFromLink($row->link)
                    ?? $this->companyFromLanding($creatorId, (int) ($row->user_id ?? 0))
                    ?? $this->onlyCompanyOf((int) ($row->user_id ?? 0));

                if ($companyId) {
                    DB::table('notifications')->where('id', $row->id)->update(['company_id' => $companyId]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'user_id', 'read']);
            $table->dropConstrainedForeignId('company_id');
        });
    }

    private function companyFromLink(?string $link): ?int
    {
        if (! $link) {
            return null;
        }

        if (preg_match('#/campaigns/(\d+)#', $link, $match)) {
            $id = DB::table('campaigns')->where('id', (int) $match[1])->value('company_id');

            return $id ? (int) $id : null;
        }

        if (preg_match('#/recurring/(\d+)#', $link, $match)) {
            $id = DB::table('recurring_contracts')->where('id', (int) $match[1])->value('company_id');

            return $id ? (int) $id : null;
        }

        return null;
    }

    private function companyFromLanding(int $creatorId, int $userId): ?int
    {
        if ($creatorId < 1 || $userId < 1) {
            return null;
        }

        $id = DB::table('company_landing_signups as signups')
            ->join('company_users', function ($join) use ($userId) {
                $join->on('company_users.company_id', '=', 'signups.company_id')
                    ->where('company_users.user_id', $userId);
            })
            ->where('signups.creator_id', $creatorId)
            ->orderByDesc('signups.id')
            ->value('signups.company_id');

        return $id ? (int) $id : null;
    }

    private function onlyCompanyOf(int $userId): ?int
    {
        if ($userId < 1) {
            return null;
        }

        $ids = DB::table('company_users')->where('user_id', $userId)->pluck('company_id');

        return $ids->count() === 1 ? (int) $ids->first() : null;
    }
};
