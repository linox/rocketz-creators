<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('recurring_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('objective')->nullable();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->string('status')->default('active');
            $table->decimal('monthly_fee', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

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

        Schema::create('content_planning_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recurring_contract_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->string('month', 7);
            $table->string('content_type');
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->text('briefing_note')->nullable();
            $table->text('briefing')->nullable();
            $table->text('references')->nullable();
            $table->text('script')->nullable();
            $table->text('caption')->nullable();
            $table->date('planned_date')->nullable();
            $table->string('status')->default('planned');
            $table->string('approval_flow')->nullable();
            $table->string('script_status')->nullable();
            $table->string('video_status')->nullable();
            $table->text('script_feedback')->nullable();
            $table->text('video_feedback')->nullable();
            $table->timestamp('script_submitted_at')->nullable();
            $table->timestamp('video_submitted_at')->nullable();
            $table->string('published_url')->nullable();
            $table->string('media_url')->nullable();
            $table->string('submission_url')->nullable();
            $table->text('submission_notes')->nullable();
            $table->text('feedback_note')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['recurring_contract_id', 'month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('content_planning_items');
        Schema::dropIfExists('recurring_contract_creators');
        Schema::dropIfExists('recurring_contracts');
    }
};
