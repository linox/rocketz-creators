<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->boolean('is_benefit_coupon')->default(false)->after('is_barter');
            $table->string('benefit_coupon_code', 40)->nullable()->after('is_benefit_coupon');
            $table->decimal('benefit_discount_percent', 5, 2)->nullable()->after('benefit_coupon_code');
            $table->decimal('benefit_commission_percent', 5, 2)->nullable()->after('benefit_discount_percent');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn([
                'is_benefit_coupon',
                'benefit_coupon_code',
                'benefit_discount_percent',
                'benefit_commission_percent',
            ]);
        });
    }
};
