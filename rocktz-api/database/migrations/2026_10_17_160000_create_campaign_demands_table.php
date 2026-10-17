<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaign_demands', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_creator_id')->constrained()->cascadeOnDelete();
            $table->string('content_type');
            $table->unsignedInteger('position');
            $table->text('pauta')->nullable();
            $table->text('script')->nullable();
            $table->string('script_file_url', 2048)->nullable();
            $table->string('script_file_name')->nullable();
            $table->string('video_url', 2048)->nullable();
            $table->unsignedBigInteger('video_file_size')->nullable();
            $table->string('image_url', 2048)->nullable();
            $table->string('published_link', 2048)->nullable();
            $table->string('script_status')->default('pending');
            $table->string('video_status')->default('pending');
            $table->string('delivery_status')->default('pending');
            $table->text('script_feedback')->nullable();
            $table->text('video_feedback')->nullable();
            $table->text('revision_details')->nullable();
            $table->timestamp('script_submitted_at')->nullable();
            $table->timestamp('video_submitted_at')->nullable();
            $table->unsignedInteger('script_version')->default(0);
            $table->unsignedInteger('video_version')->default(0);
            $table->json('submission_versions')->nullable();
            $table->json('revision_history')->nullable();
            $table->json('story_prints')->nullable();
            $table->json('metrics')->nullable();
            $table->string('pending_upload_id')->nullable();
            $table->unsignedTinyInteger('upload_progress')->nullable();
            $table->timestamps();

            $table->unique(['campaign_creator_id', 'content_type', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_demands');
    }
};
