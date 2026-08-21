<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->char('country', 2)->default('BR')->index()->after('city');
            $table->char('currency', 3)->default('BRL')->after('country');
        });

        Schema::table('creators', function (Blueprint $table) {
            $table->char('country', 2)->default('BR')->index()->after('city');
            $table->boolean('can_access_all_countries')->default(false)->after('status');
        });

        Schema::table('campaigns', function (Blueprint $table) {
            $table->char('currency', 3)->default('BRL')->after('creator_cache');
        });

        Schema::table('recurring_contracts', function (Blueprint $table) {
            $table->char('currency', 3)->default('BRL')->after('monthly_fee');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['country', 'currency']);
        });

        Schema::table('creators', function (Blueprint $table) {
            $table->dropColumn(['country', 'can_access_all_countries']);
        });

        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('currency');
        });

        Schema::table('recurring_contracts', function (Blueprint $table) {
            $table->dropColumn('currency');
        });
    }
};
