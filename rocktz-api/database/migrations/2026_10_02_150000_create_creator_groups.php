<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('creator_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('creator_group_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['creator_group_id', 'creator_id']);
        });

        Schema::create('campaign_creator_group', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->foreignId('creator_group_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['campaign_id', 'creator_group_id']);
        });

        Schema::table('campaigns', function (Blueprint $table) {
            $table->unsignedBigInteger('min_followers')->nullable();
            $table->unsignedBigInteger('max_followers')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn(['min_followers', 'max_followers']);
        });

        Schema::dropIfExists('campaign_creator_group');
        Schema::dropIfExists('creator_group_members');
        Schema::dropIfExists('creator_groups');
    }
};
