<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('active_company_id')
                ->nullable()
                ->after('locale')
                ->constrained('companies')
                ->nullOnDelete();
        });

        Schema::table('company_users', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });

        $rows = DB::table('company_users')
            ->select('user_id', DB::raw('MIN(company_id) as company_id'))
            ->groupBy('user_id')
            ->get();

        foreach ($rows as $row) {
            DB::table('users')
                ->where('id', $row->user_id)
                ->whereNull('active_company_id')
                ->update(['active_company_id' => $row->company_id]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('active_company_id');
        });

        Schema::table('company_users', function (Blueprint $table) {
            $table->unique('user_id');
        });
    }
};
