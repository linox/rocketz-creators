<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_briefings', function (Blueprint $table) {
            $table->string('script_file_url', 2048)->nullable()->after('attachments');
            $table->string('script_file_name')->nullable()->after('script_file_url');
        });

        Schema::table('campaign_creator_contents', function (Blueprint $table) {
            $table->string('script_file_url', 2048)->nullable()->after('script');
            $table->string('script_file_name')->nullable()->after('script_file_url');
        });

        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->string('pauta_script_file_url', 2048)->nullable()->after('script');
            $table->string('pauta_script_file_name')->nullable()->after('pauta_script_file_url');
            $table->string('script_file_url', 2048)->nullable()->after('pauta_script_file_name');
            $table->string('script_file_name')->nullable()->after('script_file_url');
        });
    }

    public function down(): void
    {
        Schema::table('campaign_briefings', function (Blueprint $table) {
            $table->dropColumn(['script_file_url', 'script_file_name']);
        });

        Schema::table('campaign_creator_contents', function (Blueprint $table) {
            $table->dropColumn(['script_file_url', 'script_file_name']);
        });

        Schema::table('content_planning_items', function (Blueprint $table) {
            $table->dropColumn([
                'pauta_script_file_url',
                'pauta_script_file_name',
                'script_file_url',
                'script_file_name',
            ]);
        });
    }
};
