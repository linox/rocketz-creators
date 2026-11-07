<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('creator_coupons', function (Blueprint $table) {
            $table->string('suggested_code', 64)->nullable()->after('code');
            $table->string('change_note', 500)->nullable()->after('suggested_code');
            $table->string('change_status', 20)->nullable()->after('change_note');
            $table->timestamp('change_requested_at')->nullable()->after('change_status');
        });

        DB::table('creator_coupons')
            ->where('code', 'like', '@%')
            ->orderBy('id')
            ->chunkById(100, function ($rows): void {
                foreach ($rows as $row) {
                    $next = ltrim((string) $row->code, '@');
                    if ($next === '' || $next === $row->code) {
                        continue;
                    }

                    $taken = DB::table('creator_coupons')
                        ->where('company_id', $row->company_id)
                        ->where('code', $next)
                        ->where('id', '!=', $row->id)
                        ->exists();

                    if ($taken) {
                        continue;
                    }

                    DB::table('creator_coupons')->where('id', $row->id)->update([
                        'code' => $next,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('creator_coupons', function (Blueprint $table) {
            $table->dropColumn(['suggested_code', 'change_note', 'change_status', 'change_requested_at']);
        });
    }
};
