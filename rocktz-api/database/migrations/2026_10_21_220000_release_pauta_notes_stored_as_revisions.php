<?php

use App\Services\CampaignDemandSync;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(CampaignDemandSync::class)->releaseBriefNotesStoredAsRevision();
    }

    public function down(): void
    {
        // Notes already moved onto the demand pauta stay there.
    }
};
