<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_creators', function (Blueprint $table) {
            $table->uuid('pending_upload_id')->nullable()->after('video_submitted_at');
            $table->unsignedTinyInteger('upload_progress')->nullable()->after('pending_upload_id');
            $table->index('pending_upload_id');
        });

        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->uuid('pending_upload_id')->nullable()->after('video_submitted_at');
            $table->unsignedTinyInteger('upload_progress')->nullable()->after('pending_upload_id');
            $table->index('pending_upload_id');
        });
    }

    public function down(): void
    {
        Schema::table('campaign_creators', function (Blueprint $table) {
            $table->dropIndex(['pending_upload_id']);
            $table->dropColumn(['pending_upload_id', 'upload_progress']);
        });

        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->dropIndex(['pending_upload_id']);
            $table->dropColumn(['pending_upload_id', 'upload_progress']);
        });
    }
};
