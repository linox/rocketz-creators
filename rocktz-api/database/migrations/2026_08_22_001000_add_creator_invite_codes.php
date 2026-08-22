<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('creator_invite_code', 16)->nullable()->unique()->after('status');
        });

        Schema::table('creators', function (Blueprint $table) {
            $table->foreignId('invited_by_company_id')
                ->nullable()
                ->after('can_access_all_countries')
                ->constrained('companies')
                ->nullOnDelete();
        });

        Company::query()->whereNull('creator_invite_code')->each(function (Company $company) {
            $company->forceFill([
                'creator_invite_code' => Company::generateInviteCode(),
            ])->saveQuietly();
        });
    }

    public function down(): void
    {
        Schema::table('creators', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invited_by_company_id');
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->dropUnique(['creator_invite_code']);
            $table->dropColumn('creator_invite_code');
        });
    }
};
