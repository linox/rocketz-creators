<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->text('invoice_data_campaign')->nullable()->after('payment_due_day');
            $table->text('invoice_data_recurring')->nullable()->after('invoice_data_campaign');
            $table->text('invoice_data_coupon')->nullable()->after('invoice_data_recurring');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn([
                'invoice_data_campaign',
                'invoice_data_recurring',
                'invoice_data_coupon',
            ]);
        });
    }
};
