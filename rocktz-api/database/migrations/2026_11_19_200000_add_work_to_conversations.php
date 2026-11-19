<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('campaign_id')->nullable()->after('creator_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recurring_contract_id')->nullable()->after('campaign_id')->constrained()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recurring_contract_id');
            $table->dropConstrainedForeignId('campaign_id');
        });
    }
};
