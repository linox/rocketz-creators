<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
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

        Schema::create('creator_portfolio_videos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('url');
            $table->text('description')->nullable();
            $table->timestamp('uploaded_at')->nullable();
            $table->timestamps();
        });

        Schema::create('creator_contract_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained()->cascadeOnDelete();
            $table->string('term_id');
            $table->string('version');
            $table->string('full_name');
            $table->string('document');
            $table->string('email');
            $table->timestamp('accepted_at');
            $table->string('ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('declarations');
            $table->boolean('all_accepted');
            $table->string('status')->default('valid');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('creator_contract_acceptances');
        Schema::dropIfExists('creator_portfolio_videos');
        Schema::dropIfExists('creators');
    }
};
