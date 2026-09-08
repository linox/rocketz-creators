<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storefront_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('min_completed_campaigns')->default(3);
            $table->timestamps();
        });

        DB::table('storefront_settings')->insert([
            'min_completed_campaigns' => max(1, (int) config('storefront.min_completed_campaigns', 3)),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_settings');
    }
};
