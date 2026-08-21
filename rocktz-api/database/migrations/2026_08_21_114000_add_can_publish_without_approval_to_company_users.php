<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_users', function (Blueprint $table) {
            $table->boolean('can_publish_without_approval')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('company_users', function (Blueprint $table) {
            $table->dropColumn('can_publish_without_approval');
        });
    }
};
