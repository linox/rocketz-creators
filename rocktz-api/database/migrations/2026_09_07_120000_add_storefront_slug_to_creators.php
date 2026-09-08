<?php

use App\Models\Creator;
use App\Services\CreatorStorefrontService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('creators', function (Blueprint $table) {
            $table->string('storefront_slug', 64)->nullable()->unique();
        });

        $storefronts = app(CreatorStorefrontService::class);
        Creator::query()->orderBy('id')->each(function (Creator $creator) use ($storefronts) {
            $storefronts->ensureStorefrontSlug($creator);
        });
    }

    public function down(): void
    {
        Schema::table('creators', function (Blueprint $table) {
            $table->dropUnique(['storefront_slug']);
            $table->dropColumn('storefront_slug');
        });
    }
};
