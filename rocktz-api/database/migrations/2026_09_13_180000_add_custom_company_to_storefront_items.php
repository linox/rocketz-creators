<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('creator_storefront_items', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
        });

        Schema::table('creator_storefront_items', function (Blueprint $table) {
            $table->unsignedBigInteger('company_id')->nullable()->change();
            $table->string('custom_company_name', 120)->nullable()->after('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('creator_storefront_items', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropColumn('custom_company_name');
        });

        Schema::table('creator_storefront_items', function (Blueprint $table) {
            $table->unsignedBigInteger('company_id')->nullable(false)->change();
            $table->foreign('company_id')->references('id')->on('companies')->restrictOnDelete();
        });
    }
};
