<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->decimal('agency_fee_percent', 5, 2)->default(20)->after('agency_fee');
        });

        DB::table('campaigns')->orderBy('id')->chunkById(100, function ($rows) {
            foreach ($rows as $row) {
                $budget = (float) $row->total_budget;
                $fee = (float) $row->agency_fee;
                $percent = $budget > 0 ? round($fee / $budget * 100, 2) : 20;
                $percent = max(0, min(100, $percent));

                DB::table('campaigns')->where('id', $row->id)->update([
                    'agency_fee_percent' => $percent,
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('agency_fee_percent');
        });
    }
};
