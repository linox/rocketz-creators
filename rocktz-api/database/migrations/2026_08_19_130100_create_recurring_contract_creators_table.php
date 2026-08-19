<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recurring_contract_creators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recurring_contract_id')->constrained()->cascadeOnDelete();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->decimal('monthly_cache', 12, 2)->default(0);
            $table->decimal('monthly_fee', 12, 2)->default(0);
            $table->decimal('deliverables_fee', 12, 2)->default(0);
            $table->json('monthly_deliverables')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['recurring_contract_id', 'creator_id'], 'rcc_contract_creator_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recurring_contract_creators');
    }
};
