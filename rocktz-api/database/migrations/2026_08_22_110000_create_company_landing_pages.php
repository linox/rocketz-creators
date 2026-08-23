<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_landing_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('slug', 64)->unique();
            $table->string('display_name');
            $table->string('logo_url', 2048)->nullable();
            $table->string('banner_url', 2048)->nullable();
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->string('cta_text')->nullable();
            $table->string('primary_color', 16)->nullable();
            $table->string('button_color', 16)->nullable();
            $table->string('background_color', 16)->nullable();
            $table->string('website_url', 2048)->nullable();
            $table->json('socials')->nullable();
            $table->string('status', 20)->default('draft');
            $table->unsignedBigInteger('views_count')->default(0);
            $table->unsignedBigInteger('cta_clicks_count')->default(0);
            $table->unsignedBigInteger('signups_started_count')->default(0);
            $table->unsignedBigInteger('signups_completed_count')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('company_landing_signups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_landing_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20)->default('pending');
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'creator_id']);
            $table->index(['company_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_landing_signups');
        Schema::dropIfExists('company_landing_pages');
    }
};
