<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->boolean('has_custom_contract')->default(false)->after('barter_details');
            $table->longText('custom_contract_terms')->nullable()->after('has_custom_contract');
        });

        Schema::table('campaign_creators', function (Blueprint $table) {
            $table->timestamp('custom_contract_accepted_at')->nullable()->after('contract_url');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn(['has_custom_contract', 'custom_contract_terms']);
        });

        Schema::table('campaign_creators', function (Blueprint $table) {
            $table->dropColumn('custom_contract_accepted_at');
        });
    }
};
