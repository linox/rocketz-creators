<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_deliverables', function (Blueprint $table) {
            if (! Schema::hasColumn('campaign_deliverables', 'live_instagram')) {
                $table->unsignedInteger('live_instagram')->default(0)->after('youtube');
            }
            if (! Schema::hasColumn('campaign_deliverables', 'live_tiktok')) {
                $table->unsignedInteger('live_tiktok')->default(0)->after('live_instagram');
            }
            if (! Schema::hasColumn('campaign_deliverables', 'live_youtube')) {
                $table->unsignedInteger('live_youtube')->default(0)->after('live_tiktok');
            }
        });
    }

    public function down(): void
    {
        Schema::table('campaign_deliverables', function (Blueprint $table) {
            foreach (['live_youtube', 'live_tiktok', 'live_instagram'] as $column) {
                if (Schema::hasColumn('campaign_deliverables', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
