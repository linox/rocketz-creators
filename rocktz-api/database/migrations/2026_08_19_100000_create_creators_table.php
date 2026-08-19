<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('creators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('full_name');
            $table->string('artistic_name');
            $table->string('photo_url')->nullable();
            $table->string('document')->nullable();
            $table->string('cpf')->nullable();
            $table->string('whatsapp')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->date('birth_date')->nullable();
            $table->string('pix_key')->nullable();
            $table->text('bank_details')->nullable();
            $table->json('socials')->nullable();
            $table->json('metrics')->nullable();
            $table->json('categories')->nullable();
            $table->json('pricing')->nullable();
            $table->boolean('accepts_exchange')->default(false);
            $table->boolean('accepts_paid_traffic')->default(false);
            $table->boolean('accepts_exclusivity')->default(false);
            $table->text('bio')->nullable();
            $table->json('work_affinities')->nullable();
            $table->text('internal_notes')->nullable();
            $table->string('status')->default('review')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('creators');
    }
};
