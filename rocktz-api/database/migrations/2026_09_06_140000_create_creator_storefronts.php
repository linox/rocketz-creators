<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('creators', function (Blueprint $table) {
            $table->boolean('storefront_enabled')->default(false);
            $table->boolean('storefront_show_banner')->default(true);
            $table->string('storefront_banner_url', 2048)->nullable();
        });

        Schema::create('creator_storefront_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['creator_id', 'name']);
        });

        Schema::create('creator_storefront_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('creator_storefront_categories')->nullOnDelete();
            $table->string('type');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('url', 2048);
            $table->string('coupon_code')->nullable();
            $table->string('image_url', 2048)->nullable();
            $table->boolean('is_published')->default(true);
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('shares_count')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['creator_id', 'is_published']);
        });

        Schema::create('creator_storefront_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('creator_storefront_items')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('actor_key', 64);
            $table->timestamps();
            $table->unique(['item_id', 'actor_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('creator_storefront_likes');
        Schema::dropIfExists('creator_storefront_items');
        Schema::dropIfExists('creator_storefront_categories');

        Schema::table('creators', function (Blueprint $table) {
            $table->dropColumn(['storefront_enabled', 'storefront_show_banner', 'storefront_banner_url']);
        });
    }
};
