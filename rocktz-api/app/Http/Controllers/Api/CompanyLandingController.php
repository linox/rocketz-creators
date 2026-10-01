<?php

namespace App\Http\Controllers\Api;

use App\Enums\LandingSignupStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CompanyLandingPageResource;
use App\Http\Resources\CompanyLandingSignupResource;
use App\Models\Company;
use App\Models\CompanyLandingPage;
use App\Models\CompanyLandingSignup;
use App\Services\CompanyLandingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CompanyLandingController extends Controller
{
    public function __construct(private readonly CompanyLandingService $landings) {}

    public function showPublic(string $slug): JsonResponse
    {
        $page = $this->landings->publishedBySlug($slug);

        return response()->json([
            'data' => new CompanyLandingPageResource($page),
        ]);
    }

    public function track(Request $request, string $slug): JsonResponse
    {
        $data = $request->validate([
            'event' => ['required', 'in:view,cta_click,signup_started'],
        ]);

        $page = $this->landings->publishedBySlug($slug);
        $this->landings->trackEvent($page, $data['event']);

        return response()->json(['ok' => true]);
    }

    public function claim(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();
        abort_unless($user?->role === UserRole::Creator && $user->creator, 403, __('auth.forbidden'));

        $signup = $this->landings->attributeCreator($slug, $user->creator);

        return response()->json([
            'data' => new CompanyLandingSignupResource($signup),
        ]);
    }

    public function index(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $this->landings->firstOrCreateForCompany($company);

        $pages = $company->landingPages()->with('company')->orderBy('id')->get();

        return response()->json([
            'data' => CompanyLandingPageResource::collection($pages),
        ]);
    }

    public function store(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);

        $data = $request->validate([
            'display_name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:64'],
        ]);

        $page = $this->landings->create($company, $data['display_name'], $data['slug'] ?? null);

        return $this->landingResponse($page, 201);
    }

    public function show(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);

        return $this->landingResponse($this->landings->firstOrCreateForCompany($company));
    }

    public function showOne(Request $request, Company $company, CompanyLandingPage $landing): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $this->assertOwns($company, $landing);

        return $this->landingResponse($landing);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $page = $this->landings->firstOrCreateForCompany($company);
        $page = $this->landings->update($page, $this->landingPayload($request));

        return $this->landingResponse($page);
    }

    public function updateOne(Request $request, Company $company, CompanyLandingPage $landing): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $this->assertOwns($company, $landing);

        return $this->landingResponse($this->landings->update($landing, $this->landingPayload($request)));
    }

    public function publish(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);

        return $this->landingResponse($this->landings->publish($this->landings->firstOrCreateForCompany($company)));
    }

    public function publishOne(Request $request, Company $company, CompanyLandingPage $landing): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $this->assertOwns($company, $landing);

        return $this->landingResponse($this->landings->publish($landing));
    }

    public function disable(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);

        return $this->landingResponse($this->landings->disable($this->landings->firstOrCreateForCompany($company)));
    }

    public function disableOne(Request $request, Company $company, CompanyLandingPage $landing): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $this->assertOwns($company, $landing);

        return $this->landingResponse($this->landings->disable($landing));
    }

    public function signups(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $default = $this->landings->firstOrCreateForCompany($company);

        $landingId = $request->integer('landing_id');
        $metricsPage = $default;
        if ($landingId > 0) {
            $metricsPage = CompanyLandingPage::query()
                ->where('company_id', $company->id)
                ->findOrFail($landingId);
        }

        $query = CompanyLandingSignup::query()
            ->where('company_id', $company->id)
            ->with(['creator.user', 'creator.portfolioVideos', 'reviewedBy', 'landingPage'])
            ->latest();

        if ($landingId > 0) {
            $query->where('company_landing_page_id', $metricsPage->id);
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($search = $request->string('q')->toString()) {
            $canSearchPersonal = $request->user()?->role !== UserRole::Company;
            $query->whereHas('creator', function ($builder) use ($search, $canSearchPersonal) {
                $builder->where(function ($inner) use ($search, $canSearchPersonal) {
                    $inner->where('artistic_name', 'like', "%{$search}%")
                        ->orWhere('socials', 'like', "%{$search}%");
                    if ($canSearchPersonal) {
                        $inner->orWhere('full_name', 'like', "%{$search}%");
                    }
                });
            });
        }

        return response()->json([
            'data' => CompanyLandingSignupResource::collection($query->get()),
            'metrics' => $this->landings->metrics($metricsPage),
        ]);
    }

    public function showSignup(Request $request, Company $company, CompanyLandingSignup $signup): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        abort_unless($signup->company_id === $company->id, 404);

        $signup->load(['creator.user', 'creator.portfolioVideos', 'reviewedBy', 'landingPage']);

        return response()->json([
            'data' => new CompanyLandingSignupResource($signup),
        ]);
    }

    public function updateSignup(Request $request, Company $company, CompanyLandingSignup $signup): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        abort_unless($signup->company_id === $company->id, 404);

        $data = $request->validate([
            'status' => ['required', Rule::enum(LandingSignupStatus::class)],
        ]);

        $updated = $this->landings->updateSignupStatus(
            $signup,
            LandingSignupStatus::from($data['status']),
            $request->user(),
        );

        return response()->json([
            'data' => new CompanyLandingSignupResource($updated),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function landingPayload(Request $request): array
    {
        $color = ['nullable', 'string', 'regex:/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/'];

        return $request->validate([
            'slug' => ['sometimes', 'string', 'max:64'],
            'display_name' => ['sometimes', 'string', 'max:255'],
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'banner_url' => ['nullable', 'string', 'max:2048'],
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'cta_text' => ['nullable', 'string', 'max:80'],
            'primary_color' => $color,
            'button_color' => $color,
            'background_color' => $color,
            'website_url' => ['nullable', 'string', 'max:2048'],
            'socials' => ['nullable', 'array'],
            'socials.instagram' => ['nullable', 'string', 'max:255'],
            'socials.tiktok' => ['nullable', 'string', 'max:255'],
            'socials.youtube' => ['nullable', 'string', 'max:255'],
            'socials.linkedin' => ['nullable', 'string', 'max:255'],
        ]);
    }

    private function landingResponse(CompanyLandingPage $page, int $status = 200): JsonResponse
    {
        $page->load('company');

        return response()->json([
            'data' => (new CompanyLandingPageResource($page))->additional([
                'include_private' => true,
                'metrics' => $this->landings->metrics($page),
            ]),
        ], $status);
    }

    private function assertOwns(Company $company, CompanyLandingPage $landing): void
    {
        abort_unless((int) $landing->company_id === (int) $company->id, 404);
    }

    private function authorizeCompany(Request $request, Company $company): void
    {
        $user = $request->user();

        if ($user->role === UserRole::Admin) {
            return;
        }

        abort_unless(
            $user->role === UserRole::Company && $user->belongsToCompany((int) $company->id),
            403,
            __('auth.forbidden'),
        );
    }
}
