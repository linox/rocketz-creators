<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->unsignedTinyInteger('invoice_due_day')->default(5);
            $table->unsignedTinyInteger('payment_due_day')->default(15);
        });

        Schema::create('finance_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->string('source', 20);
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('campaign_creator_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('recurring_contract_id')->nullable()->constrained()->nullOnDelete();
            $table->date('reference_month');
            $table->decimal('amount', 12, 2);
            $table->char('currency', 3)->default('BRL');
            $table->date('invoice_due_date');
            $table->date('payment_due_date')->nullable();
            $table->string('status', 32);
            $table->foreignId('invoice_media_id')->nullable()->constrained('media_files')->nullOnDelete();
            $table->timestamp('invoice_submitted_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('paid_at')->nullable();
            $table->timestamps();

            $table->string('dedupe_key')->unique();
            $table->index(['company_id', 'status']);
            $table->index(['creator_id', 'status']);
            $table->index(['status', 'invoice_due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_payments');

        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['invoice_due_day', 'payment_due_day']);
        });
    }
};
