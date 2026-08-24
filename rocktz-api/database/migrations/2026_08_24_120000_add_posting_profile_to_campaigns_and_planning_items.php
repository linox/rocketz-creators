<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->string('posting_profile')->default('creator')->after('approval_flow');
        });

        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->string('posting_profile')->default('creator')->after('approval_flow');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('posting_profile');
        });

        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->dropColumn('posting_profile');
        });
    }
};
