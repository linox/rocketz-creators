<?php

namespace Tests\Feature;

use App\Enums\ContentType;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\RecurringContract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PostMetricsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        config()->set('services.social.cache_hours', 24);
    }

    public function test_admin_can_sync_instagram_post_metrics(): void
    {
        [$campaign, $row, $token] = $this->campaignWithPublishedLink(
            'https://www.instagram.com/p/DbopAZ5BLWL/',
            ['instagram_followers' => 10000],
        );

        Http::fake([
            'https://www.instagram.com/*' => Http::response($this->instagramPostHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath("sync.{$row->id}.ok", true)
            ->assertJsonPath("sync.{$row->id}.network", 'instagram')
            ->assertJsonPath("sync.{$row->id}.likes", 260)
            ->assertJsonPath("sync.{$row->id}.comments", 31)
            ->assertJsonPath("sync.{$row->id}.engagement", 2.91);

        $this->assertDatabaseHas('campaign_creator_contents', [
            'campaign_creator_id' => $row->id,
        ]);

        $metrics = $row->content()->first()?->metrics;
        $this->assertSame(260, $metrics['likes']);
        $this->assertSame(31, $metrics['comments']);
        $this->assertSame('instagram', $metrics['network']);
    }

    public function test_tiktok_short_link_resolves_video_id_from_canonical_and_embed(): void
    {
        [$campaign, $row, $token] = $this->campaignWithPublishedLink(
            'https://vt.tiktok.com/ZSabcdef/',
            ['tiktok_followers' => 5000],
        );

        Http::fake(function (Request $request) {
            if (str_contains($request->url(), 'embed/v2/7123456789012345678')) {
                return Http::response($this->tiktokPostHtml(), 200);
            }

            if (str_contains($request->url(), 'vt.tiktok.com')) {
                return Http::response(
                    '<html><head><link rel="canonical" href="https://www.tiktok.com/@oivivi/video/7123456789012345678"></head><body></body></html>',
                    200,
                );
            }

            return Http::response('<html></html>', 200);
        });

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath('status', 'done')
            ->assertJsonPath("sync.{$row->id}.ok", true)
            ->assertJsonPath("sync.{$row->id}.likes", 1200)
            ->assertJsonPath("sync.{$row->id}.views", 9000);
    }

    public function test_instagram_reads_metrics_from_mobile_html_when_desktop_has_none(): void
    {
        [$campaign, $row, $token] = $this->campaignWithPublishedLink(
            'https://www.instagram.com/p/DZabmqRPbGK/',
            ['instagram_followers' => 10000],
        );

        Http::fake(function (Request $request) {
            $ua = $request->header('User-Agent')[0] ?? '';
            if (str_contains($ua, 'iPhone')) {
                return Http::response($this->instagramPostHtml(), 200);
            }

            return Http::response('<html><head></head><body>desktop shell</body></html>', 200);
        });

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath("sync.{$row->id}.ok", true)
            ->assertJsonPath("sync.{$row->id}.likes", 260)
            ->assertJsonPath("sync.{$row->id}.comments", 31);
    }

    public function test_instagram_reads_views_from_embed_json(): void
    {
        [$campaign, $row, $token] = $this->campaignWithPublishedLink(
            'https://www.instagram.com/p/DZabmqRPbGK/',
            ['instagram_followers' => 10000],
        );

        Http::fake(function (Request $request) {
            if (str_contains($request->url(), '/embed/')) {
                return Http::response($this->instagramEmbedHtml(), 200);
            }

            return Http::response($this->instagramPostHtml(), 200);
        });

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath("sync.{$row->id}.ok", true)
            ->assertJsonPath("sync.{$row->id}.likes", 260)
            ->assertJsonPath("sync.{$row->id}.views", 20586);
    }

    public function test_admin_can_sync_tiktok_and_youtube_posts(): void
    {
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('auth')->plainTextToken;
        $campaign = Campaign::factory()->create();

        $tiktok = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => Creator::factory()->active()->create([
                'metrics' => ['tiktok_followers' => 5000],
            ])->id,
        ]);
        CampaignCreatorContent::factory()->create([
            'campaign_creator_id' => $tiktok->id,
            'published_link' => 'https://www.tiktok.com/@demo/video/7123456789012345678',
            'metrics' => [],
        ]);

        $youtube = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => Creator::factory()->active()->create([
                'metrics' => ['youtube_followers' => 20000],
            ])->id,
        ]);
        CampaignCreatorContent::factory()->create([
            'campaign_creator_id' => $youtube->id,
            'published_link' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'metrics' => [],
        ]);

        Http::fake([
            'https://www.tiktok.com/*' => Http::response($this->tiktokPostHtml(), 200),
            'https://www.youtube.com/*' => Http::response($this->youtubePostHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath("sync.{$tiktok->id}.ok", true)
            ->assertJsonPath("sync.{$tiktok->id}.likes", 1200)
            ->assertJsonPath("sync.{$tiktok->id}.views", 9000)
            ->assertJsonPath("sync.{$youtube->id}.ok", true)
            ->assertJsonPath("sync.{$youtube->id}.likes", 800)
            ->assertJsonPath("sync.{$youtube->id}.views", 15000)
            ->assertJsonPath("sync.{$youtube->id}.comments", 45);
    }

    public function test_youtube_reads_player_json_when_html_has_no_quoted_counts(): void
    {
        [$campaign, $row, $token] = $this->campaignWithPublishedLink(
            'https://www.youtube.com/shorts/AbCdEfGhIjK',
            ['youtube_followers' => 20000],
        );

        Http::fake([
            'https://www.youtube.com/*' => Http::response($this->youtubePlayerHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath("sync.{$row->id}.ok", true)
            ->assertJsonPath("sync.{$row->id}.likes", 321)
            ->assertJsonPath("sync.{$row->id}.views", 5000)
            ->assertJsonPath("sync.{$row->id}.comments", 18);
    }

    public function test_youtube_falls_back_to_innertube_when_watch_page_is_empty(): void
    {
        [$campaign, $row, $token] = $this->campaignWithPublishedLink(
            'https://www.youtube.com/watch?v=AbCdEfGhIjK',
            ['youtube_followers' => 20000],
        );

        Http::fake(function (Request $request) {
            if (str_contains($request->url(), 'youtubei/v1/player')) {
                return Http::response([
                    'playabilityStatus' => ['status' => 'OK'],
                    'videoDetails' => ['viewCount' => '6400', 'title' => 'Short'],
                ], 200);
            }

            if (str_contains($request->url(), 'youtubei/v1/next')) {
                return Http::response([
                    'contents' => [
                        'buttonViewModel' => [
                            'accessibilityText' => 'like this video along with 210 other people',
                        ],
                    ],
                    'engagementPanels' => [[
                        'engagementPanelSectionListRenderer' => [
                            'header' => [
                                'engagementPanelTitleHeaderRenderer' => [
                                    'title' => ['runs' => [['text' => 'Comments']]],
                                    'contextualInfo' => ['runs' => [['text' => '88']]],
                                ],
                            ],
                        ],
                    ]],
                ], 200);
            }

            return Http::response('<html><body>before you continue to youtube</body></html>', 200);
        });

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath("sync.{$row->id}.ok", true)
            ->assertJsonPath("sync.{$row->id}.views", 6400)
            ->assertJsonPath("sync.{$row->id}.likes", 210)
            ->assertJsonPath("sync.{$row->id}.comments", 88);
    }

    public function test_youtube_uses_data_api_when_key_is_configured(): void
    {
        config()->set('services.social.youtube_api_key', 'test-key');
        [$campaign, $row, $token] = $this->campaignWithPublishedLink(
            'https://youtu.be/dQw4w9WgXcQ',
            ['youtube_followers' => 20000],
        );

        Http::fake([
            'https://www.googleapis.com/youtube/v3/videos*' => Http::response([
                'items' => [[
                    'statistics' => [
                        'viewCount' => '15000',
                        'likeCount' => '800',
                        'commentCount' => '45',
                    ],
                ]],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath("sync.{$row->id}.ok", true)
            ->assertJsonPath("sync.{$row->id}.likes", 800)
            ->assertJsonPath("sync.{$row->id}.views", 15000)
            ->assertJsonPath("sync.{$row->id}.comments", 45);
    }

    public function test_instagram_parses_compact_like_counts_from_description(): void
    {
        [$campaign, $row, $token] = $this->campaignWithPublishedLink(
            'https://www.instagram.com/p/DcPCA3EEi9U/',
            ['instagram_followers' => 100000],
        );

        Http::fake([
            'https://www.instagram.com/*' => Http::response(<<<'HTML'
<html><head>
<meta property="og:description" content="14K likes, 83 comments - lito on August 19, 2026" />
<script>window.__additionalData={"video_view_count":209478};</script>
</head><body>post</body></html>
HTML, 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath("sync.{$row->id}.likes", 14000)
            ->assertJsonPath("sync.{$row->id}.comments", 83)
            ->assertJsonPath("sync.{$row->id}.views", 209478);
    }

    public function test_instagram_uses_profile_lookup_for_views_when_handle_is_known(): void
    {
        [$campaign, $row, $token] = $this->campaignWithPublishedLink(
            'https://www.instagram.com/mihpocket/reel/DbopAZ5BLWL/',
            ['instagram_followers' => 58000],
        );

        Http::fake([
            'https://www.instagram.com/api/v1/users/web_profile_info/*' => Http::response([
                'data' => [
                    'user' => [
                        'username' => 'mihpocket',
                        'edge_owner_to_timeline_media' => [
                            'edges' => [[
                                'node' => [
                                    'shortcode' => 'DbopAZ5BLWL',
                                    'video_view_count' => 1463,
                                ],
                            ]],
                        ],
                    ],
                ],
            ], 200),
            'https://www.instagram.com/*' => Http::response($this->instagramPostHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertOk()
            ->assertJsonPath("sync.{$row->id}.views", 1463)
            ->assertJsonPath("sync.{$row->id}.likes", 260);
    }

    public function test_unsupported_link_returns_validation_error_when_it_is_the_only_post(): void
    {
        [$campaign, , $token] = $this->campaignWithPublishedLink('https://www.kwai.com/@demo/video/1');

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync", ['force' => true])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Este link não é de Instagram, TikTok ou YouTube.');
    }

    public function test_campaign_without_published_links_returns_error(): void
    {
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('auth')->plainTextToken;
        $campaign = Campaign::factory()->create();
        $row = CampaignCreator::factory()->approved()->create(['campaign_id' => $campaign->id]);
        CampaignCreatorContent::factory()->create([
            'campaign_creator_id' => $row->id,
            'published_link' => null,
            'metrics' => [],
        ]);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Nenhuma postagem publicada com link para analisar.');
    }

    public function test_creator_cannot_sync_campaign_post_metrics(): void
    {
        [$campaign] = $this->campaignWithPublishedLink('https://www.instagram.com/p/DbopAZ5BLWL/');
        $creator = User::factory()->creator()->create();
        $token = $creator->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/post-metrics-sync")
            ->assertForbidden();
    }

    public function test_admin_can_sync_recurring_post_metrics_for_a_month(): void
    {
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('auth')->plainTextToken;
        $creator = Creator::factory()->active()->create(['metrics' => ['instagram_followers' => 10000]]);
        $contract = RecurringContract::factory()->create();
        $item = ContentPlanningItem::factory()->published()->create([
            'recurring_contract_id' => $contract->id,
            'company_id' => $contract->company_id,
            'creator_id' => $creator->id,
            'month' => '2026-08',
            'content_type' => ContentType::Reel,
            'published_url' => 'https://www.instagram.com/p/DbopAZ5BLWL/',
            'metrics' => [],
        ]);
        $other = ContentPlanningItem::factory()->published()->create([
            'recurring_contract_id' => $contract->id,
            'company_id' => $contract->company_id,
            'creator_id' => $creator->id,
            'month' => '2026-07',
            'content_type' => ContentType::Reel,
            'published_url' => 'https://www.instagram.com/p/OtherPost123/',
            'metrics' => [],
        ]);

        Http::fake([
            'https://www.instagram.com/*' => Http::response($this->instagramPostHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/post-metrics-sync", [
                'force' => true,
                'month' => '2026-08',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'done')
            ->assertJsonPath("sync.{$item->id}.ok", true)
            ->assertJsonPath("sync.{$item->id}.likes", 260)
            ->assertJsonMissingPath("sync.{$other->id}");

        $this->assertSame(260, $item->fresh()->metrics['likes']);
        $this->assertArrayNotHasKey('likes', $other->fresh()->metrics ?? []);
    }

    public function test_creator_cannot_sync_recurring_post_metrics(): void
    {
        $contract = RecurringContract::factory()->create();
        $creator = User::factory()->creator()->create();
        $token = $creator->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/post-metrics-sync", ['month' => '2026-08'])
            ->assertForbidden();
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @return array{0: Campaign, 1: CampaignCreator, 2: string}
     */
    private function campaignWithPublishedLink(string $url, array $metrics = []): array
    {
        $admin = User::factory()->admin()->create();
        $campaign = Campaign::factory()->create();
        $row = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => Creator::factory()->active()->create([
                'metrics' => $metrics,
            ])->id,
        ]);
        CampaignCreatorContent::factory()->create([
            'campaign_creator_id' => $row->id,
            'published_link' => $url,
            'metrics' => [],
        ]);

        return [$campaign, $row->fresh('content'), $admin->createToken('auth')->plainTextToken];
    }

    private function instagramPostHtml(): string
    {
        return <<<'HTML'
<html><head>
<meta property="og:description" content="260 likes, 31 comments" />
<meta name="description" content="260 likes, 31 comments" />
</head><body>post</body></html>
HTML;
    }

    private function instagramEmbedHtml(): string
    {
        return <<<'HTML'
<html><body>
<a data-log-event="likeCountClick">260 likes</a>
<script>window.__additionalData={"dimensions":{"height":1136,"width":640},"video_duration":72.282,\"video_view_count\":20586,\"accessibility_caption\":null};</script>
</body></html>
HTML;
    }

    private function tiktokPostHtml(): string
    {
        return <<<'HTML'
<html><body>
<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{"__DEFAULT_SCOPE__":{"webapp.video-detail":{"itemInfo":{"itemStruct":{"stats":{"diggCount":1200,"commentCount":40,"playCount":9000,"shareCount":12}}}}}}</script>
</body></html>
HTML;
    }

    private function youtubePostHtml(): string
    {
        return <<<'HTML'
<html><body>
"viewCount":"15000"
"likeCount":"800"
"commentCount":"45"
</body></html>
HTML;
    }

    private function youtubePlayerHtml(): string
    {
        return <<<'HTML'
<html><body>
<script>var ytInitialPlayerResponse = {"videoDetails":{"viewCount":"5000","title":"Demo short"},"likeCount":"321"};</script>
<script>var ytInitialData = {"engagementPanels":[{"engagementPanelSectionListRenderer":{"header":{"engagementPanelTitleHeaderRenderer":{"title":{"runs":[{"text":"Comments"}]},"contextualInfo":{"runs":[{"text":"18"}]}}}}}]};</script>
</body></html>
HTML;
    }
}
