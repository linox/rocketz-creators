<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaign_creators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->string('delivery_type')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->date('delivery_date')->nullable();
            $table->date('post_date')->nullable();
            $table->string('delivery_status')->default('pending');
            $table->string('payment_status')->default('pending');
            $table->text('notes')->nullable();
            $table->string('application_status')->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->text('revision_details')->nullable();
            $table->string('script_status')->nullable()->default('pending');
            $table->string('video_status')->nullable()->default('pending');
            $table->text('script_feedback')->nullable();
            $table->text('video_feedback')->nullable();
            $table->timestamp('script_submitted_at')->nullable();
            $table->timestamp('video_submitted_at')->nullable();
            $table->string('signature_status')->default('pending');
            $table->timestamp('signature_sent_at')->nullable();
            $table->timestamp('signature_signed_at')->nullable();
            $table->string('contract_url')->nullable();
            $table->timestamps();

            $table->unique(['campaign_id', 'creator_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_creators');
    }
};
