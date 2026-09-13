<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('creator_storefront_items', function (Blueprint $table) {
            $table->unsignedInteger('clicks_count')->default(0)->after('shares_count');
        });

        Schema::create('creator_storefront_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->nullable()->constrained('creator_storefront_items')->cascadeOnDelete();
            $table->string('type', 16);
            $table->string('actor_key', 64);
            $table->timestamp('created_at')->useCurrent();

            $table->index(['creator_id', 'type', 'created_at']);
            $table->index(['item_id', 'type']);
            $table->index(['actor_key', 'creator_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('creator_storefront_events');

        Schema::table('creator_storefront_items', function (Blueprint $table) {
            $table->dropColumn('clicks_count');
        });
    }
};
