<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recurring_contracts', function (Blueprint $table) {
            $table->string('payment_mode')->default('cash')->after('status');
        });

        Schema::table('recurring_contract_creators', function (Blueprint $table) {
            $table->text('barter_details')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('recurring_contracts', function (Blueprint $table) {
            $table->dropColumn('payment_mode');
        });

        Schema::table('recurring_contract_creators', function (Blueprint $table) {
            $table->dropColumn('barter_details');
        });
    }
};
