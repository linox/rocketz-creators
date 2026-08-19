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
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('objective')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->decimal('total_budget', 12, 2)->default(0);
            $table->decimal('agency_fee', 12, 2)->default(0);
            $table->decimal('creators_budget', 12, 2)->default(0);
            $table->decimal('creator_cache', 12, 2)->default(0);
            $table->string('status')->default('briefing')->index();
            $table->string('image_url')->nullable();
            $table->boolean('is_secret')->default(false);
            $table->boolean('is_direct_contract')->default(false);
            $table->boolean('is_barter')->default(false);
            $table->text('barter_details')->nullable();
            $table->string('approval_flow')->default('script_and_video');
            $table->timestamps();
        });

        Schema::create('campaign_briefings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('product')->nullable();
            $table->text('key_message')->nullable();
            $table->text('must_have')->nullable();
            $table->text('donts')->nullable();
            $table->string('cta')->nullable();
            $table->string('hashtags')->nullable();
            $table->string('link')->nullable();
            $table->string('coupon')->nullable();
            $table->json('attachments')->nullable();
            $table->timestamps();
        });

        Schema::create('campaign_deliverables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('summary')->nullable();
            $table->unsignedInteger('reels')->default(0);
            $table->unsignedInteger('stories')->default(0);
            $table->unsignedInteger('tiktok')->default(0);
            $table->unsignedInteger('ugc')->default(0);
            $table->unsignedInteger('posts')->default(0);
            $table->unsignedInteger('youtube')->default(0);
            $table->unsignedInteger('deadline_days')->nullable();
            $table->text('guidelines')->nullable();
            $table->timestamps();
        });

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

        Schema::create('campaign_creator_contents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_creator_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('script')->nullable();
            $table->string('video_url')->nullable();
            $table->string('image_url')->nullable();
            $table->string('published_link')->nullable();
            $table->json('story_prints')->nullable();
            $table->json('metrics')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('campaign_creator_contents');
        Schema::dropIfExists('campaign_creators');
        Schema::dropIfExists('campaign_deliverables');
        Schema::dropIfExists('campaign_briefings');
        Schema::dropIfExists('campaigns');
    }
};
