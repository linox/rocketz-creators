<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_senders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->json('address');
            $table->timestamps();
        });

        Schema::table('campaigns', function (Blueprint $table) {
            $table->foreignId('shipping_sender_id')->nullable()->after('barter_details')->constrained('shipping_senders')->nullOnDelete();
            $table->string('sender_name')->nullable()->after('shipping_sender_id');
            $table->string('sender_phone')->nullable()->after('sender_name');
            $table->json('sender_address')->nullable()->after('sender_phone');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropConstrainedForeignId('shipping_sender_id');
            $table->dropColumn(['sender_name', 'sender_phone', 'sender_address']);
        });

        Schema::dropIfExists('shipping_senders');
    }
};
