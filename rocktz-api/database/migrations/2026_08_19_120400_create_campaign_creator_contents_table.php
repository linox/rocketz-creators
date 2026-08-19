<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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

    public function down(): void
    {
        Schema::dropIfExists('campaign_creator_contents');
    }
};
