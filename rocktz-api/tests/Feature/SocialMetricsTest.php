<?php

namespace Tests\Feature;

use App\Models\Creator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SocialMetricsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        config()->set('services.social.scrape_creators_key', '');
        config()->set('services.social.youtube_api_key', '');
        config()->set('services.social.cache_hours', 24);
    }

    public function test_creator_can_sync_youtube_from_public_page(): void
    {
        [$creator, $token] = $this->creatorWithToken(['youtube' => 'demo']);

        Http::fake([
            'https://www.youtube.com/*' => Http::response($this->youtubeHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'youtube',
                'handle' => '@demo',
            ])
            ->assertOk()
            ->assertJsonPath('sync.youtube.ok', true)
            ->assertJsonPath('sync.youtube.followers', 18200)
            ->assertJsonPath('sync.youtube.views', 18200)
            ->assertJsonPath('data.metrics.youtube_followers', 18200)
            ->assertJsonPath('data.socials.youtube', 'demo');
    }

    public function test_youtube_prefers_about_channel_stats_over_stale_header(): void
    {
        [$creator, $token] = $this->creatorWithToken(['youtube' => 'mihpocket']);

        Http::fake([
            'https://www.youtube.com/*' => Http::response(<<<'HTML'
<html><body>
"videoCountText":{"runs":[{"text":"64"},{"text":" vídeos"}]}
"subscriberCountText":{"accessibility":{"accessibilityData":{"label":"3,6 mil inscritos"}},"simpleText":"3,6 mil inscritos"}
"aboutChannelViewModel":{"subscriberCountText":"45,6 mil inscritos","viewCountText":"2.192.363 visualizações","videoCountText":"328 vídeos"}
</body></html>
HTML, 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'youtube',
                'handle' => '@mihpocket',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.youtube.followers', 45600)
            ->assertJsonPath('sync.youtube.views', 6684)
            ->assertJsonPath('data.metrics.youtube_followers', 45600);
    }

    public function test_creator_can_sync_instagram_and_tiktok_from_public_pages(): void
    {
        [$creator, $token] = $this->creatorWithToken([
            'instagram' => 'demo',
            'tiktok' => 'demo',
        ]);

        Http::fake([
            'https://i.instagram.com/*' => Http::response('Not Found', 404),
            'https://www.instagram.com/*' => Http::response($this->instagramHtml(), 200),
            'https://www.tiktok.com/*' => Http::response($this->tiktokHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'handles' => [
                    'instagram' => '@demo',
                    'tiktok' => '@demo',
                ],
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.ok', true)
            ->assertJsonPath('sync.instagram.followers', 12300)
            ->assertJsonPath('sync.tiktok.ok', true)
            ->assertJsonPath('sync.tiktok.followers', 15000)
            ->assertJsonPath('data.metrics.instagram_followers', 12300)
            ->assertJsonPath('data.metrics.tiktok_followers', 15000);
    }

    public function test_tiktok_falls_back_to_embed_when_profile_is_blocked(): void
    {
        [$creator, $token] = $this->creatorWithToken(['tiktok' => 'mihpocket']);

        Http::fake(function ($request) {
            if (str_contains($request->url(), '/embed/')) {
                return Http::response(
                    '"uniqueId":"mihpocket" "followerCount":8606 "heartCount":105600 "videoCount":236 "playCount":2000 "playCount":1000',
                    200
                );
            }

            return Http::response('<html>SlardarWAF login</html>', 200);
        });

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'tiktok',
                'handle' => '@mihpocket',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.tiktok.ok', true)
            ->assertJsonPath('sync.tiktok.followers', 8606)
            ->assertJsonPath('sync.tiktok.views', 1500)
            ->assertJsonPath('data.metrics.tiktok_followers', 8606);
    }

    public function test_instagram_uses_web_profile_info_json(): void
    {
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'mihpocket']);

        Http::fake([
            'https://i.instagram.com/api/v1/users/web_profile_info*' => Http::response([
                'data' => [
                    'user' => [
                        'username' => 'mihpocket',
                        'edge_followed_by' => ['count' => 58235],
                        'edge_owner_to_timeline_media' => [
                            'edges' => [
                                ['node' => [
                                    'video_view_count' => 2000,
                                    'edge_liked_by' => ['count' => 400],
                                    'edge_media_to_comment' => ['count' => 40],
                                ]],
                                ['node' => [
                                    'video_view_count' => 1000,
                                    'edge_liked_by' => ['count' => 200],
                                    'edge_media_to_comment' => ['count' => 20],
                                ]],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => '@mihpocket',
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.ok', true)
            ->assertJsonPath('sync.instagram.followers', 58235)
            ->assertJsonPath('sync.instagram.views', 1500)
            ->assertJsonPath('data.metrics.instagram_followers', 58235)
            ->assertJsonPath('data.socials.instagram', 'mihpocket');
    }

    public function test_instagram_accepts_official_instagram_handle(): void
    {
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'demo']);

        Http::fake([
            'https://i.instagram.com/api/v1/users/web_profile_info*' => Http::response([
                'data' => [
                    'user' => [
                        'username' => 'instagram',
                        'edge_followed_by' => ['count' => 680000000],
                    ],
                ],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => '@instagram',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.ok', true)
            ->assertJsonPath('sync.instagram.followers', 680000000)
            ->assertJsonPath('data.socials.instagram', 'instagram');
    }

    public function test_instagram_uses_android_app_profile_info_when_web_requires_login(): void
    {
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'pausaprorole']);

        Http::fake(function (Request $request) {
            if (str_contains($request->url(), 'i.instagram.com') && str_contains($request->header('User-Agent')[0] ?? '', 'Instagram ')) {
                return Http::response([
                    'data' => [
                        'user' => [
                            'username' => 'pausaprorole',
                            'edge_followed_by' => ['count' => 4167],
                            'edge_owner_to_timeline_media' => [
                                'edges' => [
                                    ['node' => [
                                        'video_view_count' => 800,
                                        'edge_liked_by' => ['count' => 50],
                                    ]],
                                    ['node' => [
                                        'video_view_count' => 400,
                                        'edge_liked_by' => ['count' => 20],
                                    ]],
                                ],
                            ],
                        ],
                    ],
                ], 200);
            }

            return Http::response(['message' => 'require_login', 'status' => 'fail'], 401);
        });

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => '@pausaprorole',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.ok', true)
            ->assertJsonPath('sync.instagram.followers', 4167)
            ->assertJsonPath('sync.instagram.views', 600)
            ->assertJsonPath('data.socials.instagram', 'pausaprorole');
    }

    public function test_instagram_reads_video_play_count_as_avg_views(): void
    {
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'larissamilene']);

        Http::fake([
            'https://i.instagram.com/api/v1/users/web_profile_info*' => Http::response([
                'data' => [
                    'user' => [
                        'username' => 'larissamilene',
                        'edge_followed_by' => ['count' => 1155],
                        'edge_owner_to_timeline_media' => [
                            'edges' => [
                                ['node' => [
                                    'video_play_count' => 4200,
                                    'edge_liked_by' => ['count' => 90],
                                    'edge_media_to_comment' => ['count' => 10],
                                ]],
                                ['node' => [
                                    'video_play_count' => 1800,
                                    'edge_liked_by' => ['count' => 40],
                                    'edge_media_to_comment' => ['count' => 5],
                                ]],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => '@larissamilene',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.followers', 1155)
            ->assertJsonPath('sync.instagram.views', 3000)
            ->assertJsonPath('data.metrics.instagram_views', 3000);
    }

    public function test_instagram_html_extracts_play_counts(): void
    {
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'demo']);

        Http::fake([
            'https://i.instagram.com/*' => Http::response('Not Found', 404),
            'https://www.instagram.com/*' => Http::response(
                '<html><head><meta property="og:description" content="12.3K Followers, 200 Following, 80 Posts" /></head><body>"video_play_count":8000 "video_play_count":4000</body></html>',
                200
            ),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => '@demo',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.followers', 12300)
            ->assertJsonPath('sync.instagram.views', 6000);
    }

    public function test_instagram_falls_back_to_html_when_json_endpoint_returns_404(): void
    {
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'tw2o']);

        Http::fake([
            'https://www.instagram.com/api/v1/users/web_profile_info*' => Http::response('Not Found', 404),
            'https://i.instagram.com/*' => Http::response('Not Found', 404),
            'https://www.instagram.com/*' => Http::response($this->instagramHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => '@tw2o',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.ok', true)
            ->assertJsonPath('sync.instagram.followers', 12300);
    }

    public function test_instagram_falls_back_to_embed_when_profile_is_login_walled(): void
    {
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'tw2o']);

        Http::fake(function ($request) {
            $url = $request->url();
            if (str_contains($url, 'web_profile_info')) {
                return Http::response('login required', 404);
            }
            if (str_contains($url, '/embed/')) {
                return Http::response($this->instagramHtml(), 200);
            }

            return Http::response('<html><body>Log in Sign up</body></html>', 200);
        });

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => '@tw2o',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.ok', true)
            ->assertJsonPath('sync.instagram.followers', 12300);
    }

    public function test_instagram_block_is_unavailable_not_missing_channel(): void
    {
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'tw2o']);

        Http::fake([
            'https://www.instagram.com/*' => Http::response('Not Found', 404),
            'https://i.instagram.com/*' => Http::response('Not Found', 404),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => '@tw2o',
                'force' => true,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', __('auth.social_profile_unavailable'));
    }

    public function test_scrapecreators_failure_falls_back_to_public_instagram(): void
    {
        config()->set('services.social.scrape_creators_key', 'test-key');
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'tw2o']);

        Http::fake([
            'https://api.scrapecreators.com/*' => Http::response(['error' => 'not found'], 404),
            'https://i.instagram.com/api/v1/users/web_profile_info*' => Http::response([
                'data' => [
                    'user' => [
                        'username' => 'tw2o',
                        'edge_followed_by' => ['count' => 58235],
                    ],
                ],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => '@tw2o',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.ok', true)
            ->assertJsonPath('sync.instagram.followers', 58235);
    }

    public function test_scrapecreators_fills_instagram_views_from_posts(): void
    {
        config()->set('services.social.scrape_creators_key', 'test-key');
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'demo']);

        Http::fake([
            'https://api.scrapecreators.com/v1/instagram/profile*' => Http::response([
                'user' => [
                    'username' => 'demo',
                    'edge_followed_by' => ['count' => 25116],
                ],
            ], 200),
            'https://api.scrapecreators.com/v2/instagram/user/posts*' => Http::response([
                'items' => [
                    ['play_count' => 4000, 'like_count' => 100, 'comment_count' => 10],
                    ['ig_play_count' => 2000, 'like_count' => 50, 'comment_count' => 5],
                ],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => 'demo',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.followers', 25116)
            ->assertJsonPath('sync.instagram.views', 3000);
    }

    public function test_scrapecreators_fills_tiktok_views_from_videos(): void
    {
        config()->set('services.social.scrape_creators_key', 'test-key');
        [$creator, $token] = $this->creatorWithToken(['tiktok' => 'demo']);

        Http::fake([
            'https://api.scrapecreators.com/v1/tiktok/profile*' => Http::response([
                'user' => ['uniqueId' => 'demo'],
                'stats' => [
                    'followerCount' => 15000,
                    'heartCount' => 90000,
                    'videoCount' => 30,
                ],
                'itemList' => [],
            ], 200),
            'https://api.scrapecreators.com/v3/tiktok/profile/videos*' => Http::response([
                'aweme_list' => [
                    ['statistics' => ['play_count' => 2000]],
                    ['statistics' => ['play_count' => 1000]],
                ],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'tiktok',
                'handle' => '@demo',
                'force' => true,
            ])
            ->assertOk()
            ->assertJsonPath('sync.tiktok.followers', 15000)
            ->assertJsonPath('sync.tiktok.views', 1500);
    }

    public function test_second_sync_uses_cache_without_http(): void
    {
        [$creator, $token] = $this->creatorWithToken(['youtube' => 'demo']);

        Http::fake([
            'https://www.youtube.com/*' => Http::response($this->youtubeHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", ['network' => 'youtube', 'handle' => 'demo'])
            ->assertOk()
            ->assertJsonPath('sync.youtube.cached', false);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", ['network' => 'youtube', 'handle' => 'demo'])
            ->assertOk()
            ->assertJsonPath('sync.youtube.cached', true)
            ->assertJsonPath('sync.youtube.followers', 18200);

        Http::assertSentCount(1);
    }

    public function test_scrapecreators_is_used_when_key_is_configured(): void
    {
        config()->set('services.social.scrape_creators_key', 'test-key');
        [$creator, $token] = $this->creatorWithToken(['instagram' => 'demo']);

        Http::fake([
            'https://api.scrapecreators.com/v1/instagram/profile*' => Http::response([
                'user' => [
                    'username' => 'demo',
                    'edge_followed_by' => ['count' => 25116],
                    'edge_owner_to_timeline_media' => [
                        'edges' => [
                            ['node' => [
                                'video_view_count' => 4000,
                                'edge_liked_by' => ['count' => 100],
                                'edge_media_to_comment' => ['count' => 10],
                            ]],
                            ['node' => [
                                'video_view_count' => 2000,
                                'edge_liked_by' => ['count' => 50],
                                'edge_media_to_comment' => ['count' => 5],
                            ]],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", [
                'network' => 'instagram',
                'handle' => 'demo',
            ])
            ->assertOk()
            ->assertJsonPath('sync.instagram.followers', 25116)
            ->assertJsonPath('sync.instagram.views', 3000)
            ->assertJsonPath('data.metrics.followers', 25116);
    }

    public function test_missing_handle_returns_422(): void
    {
        [$creator, $token] = $this->creatorWithToken(['youtube' => null]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", ['network' => 'youtube'])
            ->assertStatus(422)
            ->assertJsonPath('message', __('auth.social_handle_required'));
    }

    public function test_company_cannot_sync_creator_metrics(): void
    {
        $creator = Creator::factory()->create(['socials' => ['youtube' => 'demo']]);
        $company = User::factory()->company()->create();
        $token = $company->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", ['network' => 'youtube', 'handle' => 'demo'])
            ->assertForbidden();
    }

    public function test_creator_cannot_sync_another_creator(): void
    {
        $owner = Creator::factory()->create(['socials' => ['youtube' => 'demo']]);
        $other = Creator::factory()->create();
        $token = $other->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/creators/{$owner->id}/social-sync", ['network' => 'youtube', 'handle' => 'demo'])
            ->assertForbidden();
    }

    public function test_admin_can_sync_creator_metrics(): void
    {
        $creator = Creator::factory()->create(['socials' => ['youtube' => 'demo'], 'metrics' => []]);
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('auth')->plainTextToken;

        Http::fake([
            'https://www.youtube.com/*' => Http::response($this->youtubeHtml(), 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/social-sync", ['network' => 'youtube', 'handle' => 'demo'])
            ->assertOk()
            ->assertJsonPath('sync.youtube.followers', 18200);
    }

    /**
     * @param  array<string, string|null>  $socials
     * @return array{0: Creator, 1: string}
     */
    private function creatorWithToken(array $socials): array
    {
        $creator = Creator::factory()->create([
            'socials' => $socials,
            'metrics' => [],
        ]);

        return [$creator, $creator->user->createToken('auth')->plainTextToken];
    }

    private function youtubeHtml(): string
    {
        return <<<'HTML'
<html><body>
"subscriberCount":"18200"
"subscriberCountText":{"simpleText":"18.2K subscribers"}
"viewCountText":{"simpleText":"1,820,000 views"}
"videosCountText":{"simpleText":"100 videos"}
</body></html>
HTML;
    }

    private function instagramHtml(): string
    {
        return <<<'HTML'
<html><head>
<meta property="og:description" content="12.3K Followers, 200 Following, 80 Posts - See Instagram photos and videos from Demo (@demo)" />
</head><body></body></html>
HTML;
    }

    private function tiktokHtml(): string
    {
        $payload = json_encode([
            '__DEFAULT_SCOPE__' => [
                'webapp.user-detail' => [
                    'userInfo' => [
                        'user' => ['uniqueId' => 'demo'],
                        'stats' => [
                            'followerCount' => 15000,
                            'heartCount' => 90000,
                            'videoCount' => 30,
                        ],
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR);

        return '<html><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'.$payload.'</script></body></html>';
    }
}
