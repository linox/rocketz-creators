<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_deliverables');
    }
};
