<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Enums\DeliveryStatus;
use App\Enums\StorefrontItemType;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\Creator;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreatorStorefrontTest extends TestCase
{
    use RefreshDatabase;

    public function test_locked_creator_cannot_add_items_until_campaigns_or_admin_unlock(): void
    {
        $creator = Creator::factory()->active()->create();
        $token = $creator->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/creators/{$creator->id}/storefront")
            ->assertOk()
            ->assertJsonPath('data.eligibility.unlocked', false)
            ->assertJsonPath('data.eligibility.required_campaigns', 3);

        $this->getJson("/api/storefronts/{$creator->id}")->assertNotFound();

        $company = Company::factory()->active()->create();
        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/storefront/items", $this->itemPayload($company->id))
            ->assertUnprocessable()
            ->assertJsonPath('errors.storefront.0', __('auth.storefront_locked', ['count' => 3]));

        $admin = User::factory()->admin()->create();
        $adminToken = $admin->createToken('auth')->plainTextToken;
        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->patchJson("/api/creators/{$creator->id}", ['storefront_enabled' => true])
            ->assertOk()
            ->assertJsonPath('data.storefront.unlocked', true)
            ->assertJsonPath('data.storefront.enabled_by_admin', true);

        $this->getJson("/api/storefronts/{$creator->id}")->assertOk();
    }

    public function test_completed_campaigns_unlock_storefront_and_items_must_belong_to_partner_company(): void
    {
        $creator = Creator::factory()->active()->create();
        $partner = Company::factory()->active()->create();
        $outsider = Company::factory()->active()->create();
        $this->completeCampaigns($creator, $partner, 3);

        $token = $creator->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/creators/{$creator->id}/storefront")
            ->assertOk()
            ->assertJsonPath('data.eligibility.unlocked', true)
            ->assertJsonPath('data.partners.0.id', $partner->id);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/storefront/items", $this->itemPayload($outsider->id))
            ->assertUnprocessable()
            ->assertJsonPath('errors.company_id.0', __('auth.storefront_company_not_partner'));

        $created = $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/storefront/items", $this->itemPayload($partner->id, [
                'type' => StorefrontItemType::Coupon->value,
                'coupon_code' => 'LUA10',
                'title' => 'Cupom Lua',
            ]))
            ->assertCreated()
            ->json('data');

        $this->assertSame('LUA10', $created['coupon_code']);
        $this->assertSame($partner->id, $created['company_id']);

        $public = $this->getJson("/api/storefronts/{$creator->id}")
            ->assertOk()
            ->assertJsonPath('data.creator.id', $creator->id)
            ->assertJsonPath('data.items.0.title', 'Cupom Lua');

        $this->assertArrayNotHasKey('partners', $public->json('data'));
    }

    public function test_recurring_contract_also_counts_as_partner_company(): void
    {
        $creator = Creator::factory()->active()->create(['storefront_enabled' => true]);
        $company = Company::factory()->active()->create();
        $contract = RecurringContract::factory()->active()->create(['company_id' => $company->id]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $contract->id,
            'creator_id' => $creator->id,
        ]);

        $token = $creator->user->createToken('auth')->plainTextToken;
        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/storefront/items", $this->itemPayload($company->id, [
                'type' => StorefrontItemType::Link->value,
                'title' => 'Loja da marca',
            ]))
            ->assertCreated()
            ->assertJsonPath('data.type', 'link');
    }

    public function test_public_like_and_share_toggle(): void
    {
        $creator = Creator::factory()->active()->create(['storefront_enabled' => true]);
        $company = Company::factory()->active()->create();
        $this->completeCampaigns($creator, $company, 1);

        $token = $creator->user->createToken('auth')->plainTextToken;
        $itemId = $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/storefront/items", $this->itemPayload($company->id))
            ->assertCreated()
            ->json('data.id');

        $this->postJson("/api/storefronts/{$creator->id}/items/{$itemId}/like")
            ->assertOk()
            ->assertJsonPath('liked', true)
            ->assertJsonPath('likes_count', 1);

        $this->postJson("/api/storefronts/{$creator->id}/items/{$itemId}/like")
            ->assertOk()
            ->assertJsonPath('liked', false)
            ->assertJsonPath('likes_count', 0);

        $this->postJson("/api/storefronts/{$creator->id}/items/{$itemId}/share")
            ->assertOk()
            ->assertJsonPath('shares_count', 1);

        $this->getJson("/api/storefronts/{$creator->id}")
            ->assertOk()
            ->assertJsonPath('data.items.0.shares_count', 1);
    }

    public function test_categories_and_banner_settings(): void
    {
        $creator = Creator::factory()->active()->create(['storefront_enabled' => true]);
        $token = $creator->user->createToken('auth')->plainTextToken;

        $categoryId = $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/storefront/categories", ['name' => 'Beleza'])
            ->assertCreated()
            ->json('data.id');

        $this->withToken($token)
            ->patchJson("/api/creators/{$creator->id}/storefront", [
                'storefront_show_banner' => false,
                'storefront_banner_url' => 'https://example.com/hero.jpg',
            ])
            ->assertOk()
            ->assertJsonPath('data.show_banner', false)
            ->assertJsonPath('data.banner_url', null);

        $this->withToken($token)
            ->patchJson("/api/creators/{$creator->id}/storefront", [
                'storefront_show_banner' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.show_banner', true)
            ->assertJsonPath('data.banner_url', 'https://example.com/hero.jpg');

        $this->withToken($token)
            ->deleteJson("/api/creators/{$creator->id}/storefront/categories/{$categoryId}")
            ->assertOk();
    }

    public function test_public_storefront_resolves_by_slug_and_slug_can_be_updated(): void
    {
        $creator = Creator::factory()->active()->create([
            'storefront_enabled' => true,
            'artistic_name' => 'Ana Lua',
        ]);
        $token = $creator->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/creators/{$creator->id}/storefront")
            ->assertOk()
            ->assertJsonPath('data.eligibility.slug', 'ana-lua');

        $this->getJson('/api/storefronts/ana-lua')
            ->assertOk()
            ->assertJsonPath('data.creator.id', $creator->id)
            ->assertJsonPath('data.slug', 'ana-lua');

        $this->getJson("/api/storefronts/{$creator->id}")
            ->assertOk()
            ->assertJsonPath('data.creator.id', $creator->id);

        $this->withToken($token)
            ->patchJson("/api/creators/{$creator->id}/storefront", [
                'storefront_slug' => 'login',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.storefront_slug.0', __('auth.storefront_slug_reserved'));

        Creator::factory()->active()->create([
            'storefront_enabled' => true,
            'storefront_slug' => 'slug-ocupado',
        ]);
        $this->withToken($token)
            ->patchJson("/api/creators/{$creator->id}/storefront", [
                'storefront_slug' => 'slug-ocupado',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.storefront_slug.0', __('auth.storefront_slug_taken'));

        $this->withToken($token)
            ->patchJson("/api/creators/{$creator->id}/storefront", [
                'storefront_slug' => 'ana-oficial',
            ])
            ->assertOk()
            ->assertJsonPath('data.eligibility.slug', 'ana-oficial')
            ->assertJsonPath('data.slug', 'ana-oficial');

        $this->getJson('/api/storefronts/ana-oficial')->assertOk();
        $this->getJson('/api/storefronts/ana-lua')->assertNotFound();
    }

    public function test_admin_can_change_min_completed_campaigns(): void
    {
        $creator = Creator::factory()->active()->create();
        $company = Company::factory()->active()->create();
        $this->completeCampaigns($creator, $company, 1);
        $creatorToken = $creator->user->createToken('auth')->plainTextToken;

        $this->withToken($creatorToken)
            ->getJson("/api/creators/{$creator->id}/storefront")
            ->assertOk()
            ->assertJsonPath('data.eligibility.unlocked', false)
            ->assertJsonPath('data.eligibility.required_campaigns', 3);

        $admin = User::factory()->admin()->create();
        $adminToken = $admin->createToken('auth')->plainTextToken;
        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->getJson('/api/storefront/settings')
            ->assertOk()
            ->assertJsonPath('data.min_completed_campaigns', 3);

        $this->withToken($adminToken)
            ->patchJson('/api/storefront/settings', ['min_completed_campaigns' => 1])
            ->assertOk()
            ->assertJsonPath('data.min_completed_campaigns', 1)
            ->assertJsonPath('message', __('auth.storefront_settings_updated'));

        $this->app['auth']->forgetGuards();
        $this->withToken($creatorToken)
            ->getJson("/api/creators/{$creator->id}/storefront")
            ->assertOk()
            ->assertJsonPath('data.eligibility.unlocked', true)
            ->assertJsonPath('data.eligibility.required_campaigns', 1);

        $this->withToken($creatorToken)
            ->getJson('/api/storefront/settings')
            ->assertForbidden();
    }

    public function test_other_creator_cannot_manage_storefront(): void
    {
        $owner = Creator::factory()->active()->create(['storefront_enabled' => true]);
        $other = Creator::factory()->active()->create();
        $token = $other->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/creators/{$owner->id}/storefront")
            ->assertForbidden();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function itemPayload(int $companyId, array $overrides = []): array
    {
        return array_merge([
            'company_id' => $companyId,
            'type' => StorefrontItemType::Link->value,
            'title' => 'Produto parceiro',
            'description' => 'Oferta da marca',
            'url' => 'https://example.com/oferta',
            'image_url' => 'https://example.com/item.jpg',
            'is_published' => true,
        ], $overrides);
    }

    private function completeCampaigns(Creator $creator, Company $company, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $campaign = Campaign::factory()->create([
                'company_id' => $company->id,
                'status' => CampaignStatus::Finished,
            ]);
            CampaignCreator::factory()->paidAndSigned()->create([
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
                'application_status' => ApplicationStatus::Approved,
                'delivery_status' => DeliveryStatus::Published,
            ]);
        }
    }
}
