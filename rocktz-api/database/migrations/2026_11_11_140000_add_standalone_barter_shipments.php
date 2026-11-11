<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barter_shipments', function (Blueprint $table) {
            $table->dropForeign(['campaign_creator_id']);
        });

        Schema::table('barter_shipments', function (Blueprint $table) {
            $table->dropUnique(['campaign_creator_id']);
        });

        Schema::table('barter_shipments', function (Blueprint $table) {
            $table->unsignedBigInteger('campaign_creator_id')->nullable()->change();
        });

        Schema::table('barter_shipments', function (Blueprint $table) {
            $table->unique('campaign_creator_id');
            $table->foreign('campaign_creator_id')->references('id')->on('campaign_creators')->cascadeOnDelete();
            $table->foreignId('creator_id')->nullable()->after('campaign_creator_id')->constrained()->nullOnDelete();
            $table->foreignId('company_id')->nullable()->after('creator_id')->constrained()->nullOnDelete();
            $table->string('description', 180)->nullable()->after('company_id');
        });
    }

    public function down(): void
    {
        Schema::table('barter_shipments', function (Blueprint $table) {
            $table->dropForeign(['creator_id']);
            $table->dropForeign(['company_id']);
            $table->dropColumn(['creator_id', 'company_id', 'description']);
            $table->dropForeign(['campaign_creator_id']);
            $table->dropUnique(['campaign_creator_id']);
        });

        Schema::table('barter_shipments', function (Blueprint $table) {
            $table->unsignedBigInteger('campaign_creator_id')->nullable(false)->change();
            $table->unique('campaign_creator_id');
            $table->foreign('campaign_creator_id')->references('id')->on('campaign_creators')->cascadeOnDelete();
        });
    }
};
