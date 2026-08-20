<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('creator_portfolio_videos', function (Blueprint $table) {
            $table->string('orientation')->nullable()->after('description');
            $table->unsignedBigInteger('file_size')->default(0)->after('orientation');
        });
    }

    public function down(): void
    {
        Schema::table('creator_portfolio_videos', function (Blueprint $table) {
            $table->dropColumn(['orientation', 'file_size']);
        });
    }
};
