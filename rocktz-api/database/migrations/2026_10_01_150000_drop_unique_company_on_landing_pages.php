<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $names = collect(Schema::getIndexes('company_landing_pages'))->pluck('name');

        if (! $names->contains('company_landing_pages_company_id_unique')) {
            return;
        }

        Schema::table('company_landing_pages', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropUnique(['company_id']);
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        $names = collect(Schema::getIndexes('company_landing_pages'))->pluck('name');

        if ($names->contains('company_landing_pages_company_id_unique')) {
            return;
        }

        Schema::table('company_landing_pages', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->unique('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
    }
};
