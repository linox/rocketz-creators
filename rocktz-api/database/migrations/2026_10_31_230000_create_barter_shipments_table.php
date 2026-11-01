<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('barter_shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_creator_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('method', 20);
            $table->string('tracking_code', 20)->nullable();
            $table->string('carrier_label', 80)->nullable();
            $table->string('status', 32)->default('pending');
            $table->string('status_label', 180)->nullable();
            $table->string('service_label', 80)->nullable();
            $table->json('events')->nullable();
            $table->unsignedSmallInteger('days_in_transit')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->string('last_error', 40)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('tracking_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('barter_shipments');
    }
};
