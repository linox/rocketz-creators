<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('creator_coupon_earnings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->date('reference_month');
            $table->decimal('amount', 12, 2);
            $table->char('currency', 3)->default('BRL');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'creator_id', 'reference_month'], 'coupon_earnings_company_creator_month');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('creator_coupon_earnings');
    }
};
