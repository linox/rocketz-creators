<?php

namespace App\Http\Controllers\Api;

use App\Enums\LandingSignupStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CompanyLandingPageResource;
use App\Http\Resources\CompanyLandingSignupResource;
use App\Models\Company;
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

    public function show(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $page = $this->landings->firstOrCreateForCompany($company)->load('company');

        return response()->json([
            'data' => (new CompanyLandingPageResource($page))->additional([
                'include_private' => true,
                'metrics' => $this->landings->metrics($page),
            ]),
        ]);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $page = $this->landings->firstOrCreateForCompany($company);

        $color = ['nullable', 'string', 'regex:/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/'];

        $data = $request->validate([
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

        $page = $this->landings->update($page, $data)->load('company');

        return response()->json([
            'data' => (new CompanyLandingPageResource($page))->additional([
                'include_private' => true,
                'metrics' => $this->landings->metrics($page),
            ]),
        ]);
    }

    public function publish(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $page = $this->landings->publish($this->landings->firstOrCreateForCompany($company))->load('company');

        return response()->json([
            'data' => (new CompanyLandingPageResource($page))->additional([
                'include_private' => true,
                'metrics' => $this->landings->metrics($page),
            ]),
        ]);
    }

    public function disable(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $page = $this->landings->disable($this->landings->firstOrCreateForCompany($company))->load('company');

        return response()->json([
            'data' => (new CompanyLandingPageResource($page))->additional([
                'include_private' => true,
                'metrics' => $this->landings->metrics($page),
            ]),
        ]);
    }

    public function signups(Request $request, Company $company): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        $page = $this->landings->firstOrCreateForCompany($company);

        $query = $page->signups()
            ->with(['creator.user', 'creator.portfolioVideos', 'reviewedBy'])
            ->latest();

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
            'metrics' => $this->landings->metrics($page),
        ]);
    }

    public function showSignup(Request $request, Company $company, CompanyLandingSignup $signup): JsonResponse
    {
        $this->authorizeCompany($request, $company);
        abort_unless($signup->company_id === $company->id, 404);

        $signup->load(['creator.user', 'creator.portfolioVideos', 'reviewedBy']);

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
