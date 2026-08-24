<?php

use App\Enums\Permission;
use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $slug = Permission::MailManage->value;
        $now = now();
        $adminIds = DB::table('users')->where('role', UserRole::Admin->value)->pluck('id');

        foreach ($adminIds as $userId) {
            $exists = DB::table('user_permissions')
                ->where('user_id', $userId)
                ->where('permission', $slug)
                ->exists();
            if ($exists) {
                continue;
            }
            DB::table('user_permissions')->insert([
                'user_id' => $userId,
                'permission' => $slug,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('user_permissions')->where('permission', Permission::MailManage->value)->delete();
    }
};
