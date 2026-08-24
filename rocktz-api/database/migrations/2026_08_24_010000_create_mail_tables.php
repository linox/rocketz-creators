<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mail_templates', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('audience');
            $table->string('category');
            $table->boolean('enabled')->default(true);
            $table->json('reminder_offsets')->nullable();
            $table->timestamps();
        });

        Schema::create('mail_template_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mail_template_id')->constrained('mail_templates')->cascadeOnDelete();
            $table->string('locale', 8);
            $table->string('subject');
            $table->text('greeting')->nullable();
            $table->text('body');
            $table->string('cta_label')->nullable();
            $table->boolean('is_default')->default(false);
            $table->foreignId('restored_from_id')->nullable()->constrained('mail_template_versions')->nullOnDelete();
            $table->timestamps();

            $table->index(['mail_template_id', 'locale']);
        });

        Schema::create('user_notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('opportunities')->default(true);
            $table->boolean('campaign_updates')->default(true);
            $table->boolean('new_demands')->default(true);
            $table->boolean('deadline_reminders')->default(true);
            $table->boolean('delivery_updates')->default(true);
            $table->boolean('promotional')->default(true);
            $table->timestamps();
        });

        Schema::create('mail_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->string('template_key');
            $table->string('subject');
            $table->string('status');
            $table->string('provider_id')->nullable()->index();
            $table->string('idempotency_key', 64)->unique();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('failure_reason')->nullable();
            $table->nullableMorphs('related');
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('creator_id')->nullable()->constrained()->nullOnDelete();
            $table->json('payload')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->timestamps();

            $table->index(['template_key', 'status']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_messages');
        Schema::dropIfExists('user_notification_preferences');
        Schema::dropIfExists('mail_template_versions');
        Schema::dropIfExists('mail_templates');
    }
};
