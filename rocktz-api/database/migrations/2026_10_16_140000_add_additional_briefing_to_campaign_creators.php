<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_creators', function (Blueprint $table) {
            $table->text('additional_briefing')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('campaign_creators', function (Blueprint $table) {
            $table->dropColumn('additional_briefing');
        });
    }
};
