<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaign_briefings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('product')->nullable();
            $table->text('key_message')->nullable();
            $table->text('must_have')->nullable();
            $table->text('donts')->nullable();
            $table->string('cta')->nullable();
            $table->string('hashtags')->nullable();
            $table->string('link')->nullable();
            $table->string('coupon')->nullable();
            $table->json('attachments')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_briefings');
    }
};
