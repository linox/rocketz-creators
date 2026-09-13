<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->date('post_date')->nullable()->after('planned_date');
            $table->index('post_date');
        });

        DB::table('content_planning_items')
            ->whereNull('post_date')
            ->whereNotNull('planned_date')
            ->update(['post_date' => DB::raw('planned_date')]);
    }

    public function down(): void
    {
        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->dropIndex(['post_date']);
            $table->dropColumn('post_date');
        });
    }
};
