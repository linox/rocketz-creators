<?php

namespace Tests\Unit;

use App\Models\Company;
use App\Models\CompanyLandingPage;
use App\Support\CompanyLandingSeo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyLandingSeoTest extends TestCase
{
    use RefreshDatabase;

    public function test_share_title_uses_company_display_name(): void
    {
        config(['app.url' => 'https://api.creatorz.digital', 'app.frontend_url' => 'https://creatorz.digital']);

        $company = Company::factory()->active()->create(['name' => 'Toca Fit']);
        $page = CompanyLandingPage::factory()->published()->create([
            'company_id' => $company->id,
            'slug' => 'toca-fit',
            'display_name' => 'Toca Fit',
            'description' => 'Creators da academia.',
            'banner_url' => 'https://api.creatorz.digital/stream/avatars/banner.jpg',
        ]);

        $seo = CompanyLandingSeo::for($page);

        $this->assertSame('Creatorz - Toca Fit', $seo['title']);
        $this->assertSame('Creators da academia.', $seo['description']);
        $this->assertSame('https://api.creatorz.digital/stream/avatars/banner.jpg', $seo['image']);
        $this->assertSame('https://creatorz.digital/l/toca-fit/', $seo['url']);
    }
}
