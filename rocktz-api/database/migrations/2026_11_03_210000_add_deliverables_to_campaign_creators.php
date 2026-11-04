<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_creators', function (Blueprint $table) {
            if (! Schema::hasColumn('campaign_creators', 'deliverables')) {
                $table->json('deliverables')->nullable()->after('delivery_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('campaign_creators', function (Blueprint $table) {
            if (Schema::hasColumn('campaign_creators', 'deliverables')) {
                $table->dropColumn('deliverables');
            }
        });
    }
};
