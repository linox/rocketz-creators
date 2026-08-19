<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('objective')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->decimal('total_budget', 12, 2)->default(0);
            $table->decimal('agency_fee', 12, 2)->default(0);
            $table->decimal('creators_budget', 12, 2)->default(0);
            $table->decimal('creator_cache', 12, 2)->default(0);
            $table->string('status')->default('briefing')->index();
            $table->string('image_url')->nullable();
            $table->boolean('is_secret')->default(false);
            $table->boolean('is_direct_contract')->default(false);
            $table->boolean('is_barter')->default(false);
            $table->text('barter_details')->nullable();
            $table->string('approval_flow')->default('script_and_video');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaigns');
    }
};
