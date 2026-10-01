<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $pageIndexes = collect(Schema::getIndexes('company_landing_pages'))->pluck('name');
        if ($pageIndexes->contains('company_landing_pages_company_id_unique')) {
            Schema::table('company_landing_pages', function (Blueprint $table) {
                $table->dropForeign(['company_id']);
                $table->dropUnique(['company_id']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }

        $signupIndexes = collect(Schema::getIndexes('company_landing_signups'))->pluck('name');
        if ($signupIndexes->contains('company_landing_signups_company_id_creator_id_unique')) {
            Schema::table('company_landing_signups', function (Blueprint $table) {
                $table->dropUnique(['company_id', 'creator_id']);
            });
        }

        $signupIndexes = collect(Schema::getIndexes('company_landing_signups'))->pluck('name');
        if (! $signupIndexes->contains('landing_signups_page_creator_unique')) {
            Schema::table('company_landing_signups', function (Blueprint $table) {
                $table->unique(['company_landing_page_id', 'creator_id'], 'landing_signups_page_creator_unique');
            });
        }
    }

    public function down(): void
    {
        $signupIndexes = collect(Schema::getIndexes('company_landing_signups'))->pluck('name');
        if ($signupIndexes->contains('landing_signups_page_creator_unique')) {
            Schema::table('company_landing_signups', function (Blueprint $table) {
                $table->dropUnique('landing_signups_page_creator_unique');
            });
        }

        $signupIndexes = collect(Schema::getIndexes('company_landing_signups'))->pluck('name');
        if (! $signupIndexes->contains('company_landing_signups_company_id_creator_id_unique')) {
            Schema::table('company_landing_signups', function (Blueprint $table) {
                $table->unique(['company_id', 'creator_id']);
            });
        }

        $pageIndexes = collect(Schema::getIndexes('company_landing_pages'))->pluck('name');
        if (! $pageIndexes->contains('company_landing_pages_company_id_unique')) {
            Schema::table('company_landing_pages', function (Blueprint $table) {
                $table->dropForeign(['company_id']);
                $table->unique('company_id');
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }
    }
};
