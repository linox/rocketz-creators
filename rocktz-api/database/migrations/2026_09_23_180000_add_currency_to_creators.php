<?php

use App\Support\Geo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('creators', function (Blueprint $table) {
            $table->char('currency', 3)->default('BRL')->after('country');
        });

        foreach (Geo::countries() as $country => $currency) {
            DB::table('creators')->where('country', $country)->update(['currency' => $currency]);
        }
    }

    public function down(): void
    {
        Schema::table('creators', function (Blueprint $table) {
            $table->dropColumn('currency');
        });
    }
};
