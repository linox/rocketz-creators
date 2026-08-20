<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_creator_contents', function (Blueprint $table) {
            $table->unsignedBigInteger('video_file_size')->default(0)->after('video_url');
        });
    }

    public function down(): void
    {
        Schema::table('campaign_creator_contents', function (Blueprint $table) {
            $table->dropColumn('video_file_size');
        });
    }
};
