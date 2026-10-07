<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CampaignResource;
use App\Models\Campaign;
use App\Models\ShippingSender;
use App\Models\User;
use App\Support\ShippingAddress;
use App\Support\ShippingLabelExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ShippingLabelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $senders = ShippingSender::query()
            ->visibleTo($request->user())
            ->with('company:id,name')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $senders->map(fn (ShippingSender $sender) => [
                'id' => $sender->id,
                'company_id' => $sender->company_id ? (int) $sender->company_id : null,
                'company_name' => $sender->company?->name,
                'name' => $sender->name,
                'phone' => $sender->phone,
                'address' => $sender->address,
            ])->values(),
        ]);
    }

    public function update(Request $request, Campaign $campaign): JsonResponse
    {
        $this->assertCanManage($request, $campaign);
        abort_unless($campaign->is_barter, 422, __('shipping.not_barter'));

        $data = $request->validate([
            'shipping_sender_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['required', 'array'],
            'address.country' => ['nullable', 'string', 'max:2'],
            'address.zip' => ['nullable', 'string', 'max:20'],
            'address.street' => ['nullable', 'string', 'max:180'],
            'address.number' => ['nullable', 'string', 'max:30'],
            'address.complement' => ['nullable', 'string', 'max:120'],
            'address.neighborhood' => ['nullable', 'string', 'max:120'],
            'address.city' => ['nullable', 'string', 'max:120'],
            'address.state' => ['nullable', 'string', 'max:12'],
        ]);

        $user = $request->user();
        $name = trim($data['name']);
        $phone = trim((string) ($data['phone'] ?? ''));
        $phone = $phone !== '' ? $phone : null;
        $address = ShippingAddress::normalize($data['address'], (string) ($campaign->company?->country ?: 'BR'));
        $fingerprint = ShippingAddress::fingerprint($name, $phone, $address);

        $selected = null;
        if (! empty($data['shipping_sender_id'])) {
            $selected = ShippingSender::query()->find((int) $data['shipping_sender_id']);
            abort_unless($selected && $this->canUseSender($user, $campaign, $selected), 403, __('shipping.sender_forbidden'));
        }

        $sender = $selected && $this->sameSender($selected, $fingerprint)
            ? $selected
            : $this->findOrCreate($user, $campaign, $name, $phone, $address, $fingerprint);

        $campaign->forceFill([
            'shipping_sender_id' => $sender->id,
            'sender_name' => $sender->name,
            'sender_phone' => $sender->phone,
            'sender_address' => $sender->address,
        ])->save();

        $campaign->load(['company', 'briefing', 'deliverable', 'landingPage', 'creatorGroups', 'campaignCreators.creator', 'campaignCreators.content']);
        $campaign->loadCount(['campaignCreators as pending_applications_count' => fn ($query) => $query->where('application_status', ApplicationStatus::Pending)]);

        return response()->json(['data' => new CampaignResource($campaign)]);
    }

    public function download(Request $request, Campaign $campaign): Response
    {
        $this->assertCanManage($request, $campaign);
        abort_unless($campaign->is_barter, 422, __('shipping.not_barter'));

        $format = $request->validate([
            'format' => ['required', 'in:pdf,csv'],
        ])['format'];

        abort_unless(filled($campaign->sender_name) && is_array($campaign->sender_address), 422, __('shipping.sender_required'));

        $rows = ShippingLabelExport::approved($campaign);
        abort_if($rows->isEmpty(), 422, __('shipping.no_approved'));

        if ($format === 'csv') {
            return response(ShippingLabelExport::csv($campaign, $rows), 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'.ShippingLabelExport::filename($campaign, 'csv').'"',
            ]);
        }

        $printable = $rows->filter(function ($row) {
            $creator = $row->creator;

            return $creator && ShippingAddress::isComplete($creator->shipping_address, $creator->countryCode());
        });
        abort_if($printable->isEmpty(), 422, __('shipping.no_recipients'));

        return response(ShippingLabelExport::pdf($campaign, $rows), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.ShippingLabelExport::filename($campaign, 'pdf').'"',
        ]);
    }

    private function assertCanManage(Request $request, Campaign $campaign): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        if ($user->role === UserRole::Company && $user->belongsToCompany((int) $campaign->company_id)) {
            return;
        }

        abort(403, __('auth.forbidden'));
    }

    private function canUseSender(User $user, Campaign $campaign, ShippingSender $sender): bool
    {
        if ($user->role === UserRole::Admin) {
            return true;
        }

        return (int) $sender->company_id === (int) $campaign->company_id
            && $user->belongsToCompany((int) $campaign->company_id);
    }

    private function sameSender(ShippingSender $sender, string $fingerprint): bool
    {
        $address = is_array($sender->address) ? $sender->address : [];

        return ShippingAddress::fingerprint($sender->name, $sender->phone, $address) === $fingerprint;
    }

    /**
     * @param  array<string, mixed>  $address
     */
    private function findOrCreate(User $user, Campaign $campaign, string $name, ?string $phone, array $address, string $fingerprint): ShippingSender
    {
        $query = ShippingSender::query()->orderBy('id');
        if ($user->role !== UserRole::Admin) {
            $query->where('company_id', $campaign->company_id);
        }

        $existing = $query->get()->first(fn (ShippingSender $sender) => $this->sameSender($sender, $fingerprint));
        if ($existing) {
            return $existing;
        }

        return ShippingSender::query()->create([
            'company_id' => $user->role === UserRole::Admin ? null : $campaign->company_id,
            'created_by_user_id' => $user->id,
            'name' => $name,
            'phone' => $phone,
            'address' => $address,
        ]);
    }
}
