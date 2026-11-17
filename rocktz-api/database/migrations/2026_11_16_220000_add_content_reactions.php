<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['campaign_demands', 'campaign_creators', 'content_planning_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->boolean('script_liked')->default(false);
                $table->text('script_reaction')->nullable();
                $table->boolean('video_liked')->default(false);
                $table->text('video_reaction')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['campaign_demands', 'campaign_creators', 'content_planning_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn(['script_liked', 'script_reaction', 'video_liked', 'video_reaction']);
            });
        }
    }
};
