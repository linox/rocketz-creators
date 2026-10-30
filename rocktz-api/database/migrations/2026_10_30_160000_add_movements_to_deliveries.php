<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['campaign_demands', 'campaign_creator_contents', 'content_planning_items'] as $table) {
            if (! Schema::hasTable($table) || Schema::hasColumn($table, 'movements')) {
                continue;
            }
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->json('movements')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['campaign_demands', 'campaign_creator_contents', 'content_planning_items'] as $table) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'movements')) {
                continue;
            }
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropColumn('movements');
            });
        }
    }
};
