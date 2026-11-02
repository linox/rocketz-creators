<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('user_permissions')->where('permission', 'data.reset')->delete();
    }

    public function down(): void
    {
        // A permissão não volta: não existe mais ação de zerar casting, campanhas ou recorrência.
    }
};
