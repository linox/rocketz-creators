<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('browser_alert_pings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('alert_key');
            $table->string('fingerprint')->default('');
            $table->unsignedTinyInteger('ping_count')->default(0);
            $table->date('ping_on')->nullable();
            $table->timestamp('last_ping_at')->nullable();
            $table->timestamp('seen_at')->nullable();
            $table->string('seen_fingerprint')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'alert_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('browser_alert_pings');
    }
};
