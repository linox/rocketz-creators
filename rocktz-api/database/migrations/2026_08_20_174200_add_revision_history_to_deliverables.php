<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->json('revision_history')->nullable()->after('submission_versions');
        });
    }

    public function down(): void
    {
        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->dropColumn('revision_history');
        });
    }
};
