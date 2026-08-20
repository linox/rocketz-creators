<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->unsignedInteger('script_version')->default(0)->after('script_submitted_at');
            $table->unsignedInteger('video_version')->default(0)->after('script_version');
            $table->json('submission_versions')->nullable()->after('video_version');
        });

        Schema::table('campaign_creator_contents', function (Blueprint $table) {
            $table->unsignedInteger('script_version')->default(0)->after('published_link');
            $table->unsignedInteger('video_version')->default(0)->after('script_version');
            $table->json('submission_versions')->nullable()->after('video_version');
        });
    }

    public function down(): void
    {
        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->dropColumn(['script_version', 'video_version', 'submission_versions']);
        });

        Schema::table('campaign_creator_contents', function (Blueprint $table) {
            $table->dropColumn(['script_version', 'video_version', 'submission_versions']);
        });
    }
};
