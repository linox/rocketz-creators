<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('creators', function (Blueprint $table) {
            $table->json('shipping_address')->nullable()->after('birth_date');
        });

        Schema::table('campaigns', function (Blueprint $table) {
            $table->boolean('limit_by_age')->default(false)->after('limit_by_city');
            $table->unsignedTinyInteger('min_age')->nullable()->after('limit_by_age');
            $table->unsignedTinyInteger('max_age')->nullable()->after('min_age');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn(['limit_by_age', 'min_age', 'max_age']);
        });

        Schema::table('creators', function (Blueprint $table) {
            $table->dropColumn('shipping_address');
        });
    }
};
