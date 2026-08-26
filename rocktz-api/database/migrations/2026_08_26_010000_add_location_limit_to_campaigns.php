<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->boolean('limit_by_city')->default(false)->after('is_barter');
            $table->string('state', 12)->nullable()->after('limit_by_city');
            $table->string('city', 120)->nullable()->after('state');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn(['limit_by_city', 'state', 'city']);
        });
    }
};
