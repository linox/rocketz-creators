<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('campaign_creators', 'favorited')) {
            return;
        }

        Schema::table('campaign_creators', function (Blueprint $table) {
            $table->boolean('favorited')->default(false);
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('campaign_creators', 'favorited')) {
            return;
        }

        Schema::table('campaign_creators', function (Blueprint $table) {
            $table->dropColumn('favorited');
        });
    }
};
