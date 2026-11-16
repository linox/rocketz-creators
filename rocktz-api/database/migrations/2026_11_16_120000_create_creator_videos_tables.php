<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('creator_videos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('recurring_contract_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('campaign_demand_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('content_planning_item_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('campaign_creator_content_id')->nullable()->unique()->constrained('campaign_creator_contents')->nullOnDelete();
            $table->string('content_type')->nullable();
            $table->unsignedInteger('position')->nullable();
            $table->string('title');
            $table->string('video_url', 2048);
            $table->unsignedBigInteger('video_file_size')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->string('source');
            $table->json('dismissed_fingerprints')->nullable();
            $table->timestamps();
        });

        Schema::create('creator_video_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_video_id')->constrained()->cascadeOnDelete();
            $table->string('kind');
            $table->string('url', 2048)->nullable();
            $table->text('note')->nullable();
            $table->timestamp('occurred_at');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source');
            $table->string('fingerprint')->nullable();
            $table->timestamps();

            $table->unique(['creator_video_id', 'fingerprint']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('creator_video_usages');
        Schema::dropIfExists('creator_videos');
    }
};
