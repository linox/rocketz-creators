<?php

use App\Enums\Permission;
use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('permission');
            $table->timestamps();
            $table->unique(['user_id', 'permission']);
        });

        $now = now();
        $adminPerms = Permission::slugsForRole(UserRole::Admin);
        $adminIds = DB::table('users')->where('role', UserRole::Admin->value)->pluck('id');
        foreach ($adminIds as $userId) {
            foreach ($adminPerms as $permission) {
                DB::table('user_permissions')->insert([
                    'user_id' => $userId,
                    'permission' => $permission,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        $companyUserIds = DB::table('company_users')
            ->where('can_publish_without_approval', true)
            ->whereNotNull('user_id')
            ->pluck('user_id');
        foreach ($companyUserIds as $userId) {
            DB::table('user_permissions')->insert([
                'user_id' => $userId,
                'permission' => Permission::CampaignsPublishWithoutApproval->value,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_permissions');
    }
};
