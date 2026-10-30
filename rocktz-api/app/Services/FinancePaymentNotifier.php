<?php

namespace App\Services;

use App\Enums\FinancePaymentSource;
use App\Enums\MailTemplateKey;
use App\Enums\NotificationType;
use App\Enums\Permission;
use App\Models\Company;
use App\Models\FinancePayment;
use App\Models\MailTemplate;
use App\Models\User;
use App\Services\Mail\TransactionalMailService;
use App\Support\FrontendUrl;
use Illuminate\Support\Carbon;

class FinancePaymentNotifier
{
    public function __construct(
        private readonly TransactionalMailService $mail,
        private readonly NotificationService $notifications,
    ) {}

    public function remind(FinancePaymentSync $sync): void
    {
        $sync->sync();

        $offsets = MailTemplate::query()->where('key', MailTemplateKey::InvoiceDue->value)->value('reminder_offsets')
            ?: MailTemplateKey::InvoiceDue->defaultReminderOffsets();

        FinancePayment::query()
            ->with(['creator.user', 'company', 'campaign', 'recurringContract'])
            ->whereIn('status', ['awaiting_invoice', 'rejected'])
            ->orderBy('id')
            ->each(function (FinancePayment $payment) use ($offsets) {
                $user = $payment->creator?->user;
                if (! $user || ! $payment->invoice_due_date) {
                    return;
                }

                foreach ($offsets as $offset) {
                    if ($this->matchesOffset($payment->invoice_due_date, (int) $offset)) {
                        $this->mail->send(
                            MailTemplateKey::InvoiceDue,
                            $user,
                            $this->context($payment),
                            $payment,
                            'due:'.$offset,
                        );
                    }
                }

                if ($payment->invoice_due_date->copy()->startOfDay()->lt(now()->startOfDay())) {
                    $this->mail->send(
                        MailTemplateKey::InvoiceOverdue,
                        $user,
                        $this->context($payment),
                        $payment,
                        'overdue:'.now()->toDateString(),
                    );
                }
            });
    }

    public function invoiceSubmitted(FinancePayment $payment): void
    {
        $payment->loadMissing(['creator.user', 'company.companyUsers.user', 'campaign', 'recurringContract']);
        $context = $this->context($payment);
        $company = $payment->company;

        if ($company) {
            $company->loadMissing('companyUsers.user');
            foreach ($company->companyUsers as $row) {
                if (! $row->user) {
                    continue;
                }
                $this->mailToCompany($row->user, $company, MailTemplateKey::InvoiceSubmitted, $context, $payment, 'submitted');
            }
        }

        User::query()->adminsWithPermission(Permission::FinanceAccess)->orderBy('id')->each(function (User $admin) use ($context, $payment) {
            $this->mail->send(MailTemplateKey::InvoiceSubmitted, $admin, $context, $payment, 'submitted');
        });

        $title = __('auth.finance_invoice_submitted_title');
        $message = __('auth.finance_invoice_submitted', [
            'creator' => $payment->creator?->artistic_name ?: $payment->creator?->full_name,
            'work' => $context['nome_campanha'],
        ]);

        if ($company) {
            $this->notifications->notifyCompany($company->id, [
                'title' => $title,
                'message' => $message,
                'type' => NotificationType::General,
                'link' => '/finance',
                'campaign_id' => $payment->campaign_id,
                'creator_id' => $payment->creator_id,
                'recurring_contract_id' => $payment->recurring_contract_id,
            ]);
        }

        $this->notifications->notifyAdminsWithPermission(Permission::FinanceAccess, $title, $message, NotificationType::General, '/finance', [
            'campaign_id' => $payment->campaign_id,
            'creator_id' => $payment->creator_id,
            'recurring_contract_id' => $payment->recurring_contract_id,
        ]);
    }

    public function invoiceRejected(FinancePayment $payment): void
    {
        $payment->loadMissing(['creator.user', 'company', 'campaign', 'recurringContract']);
        $user = $payment->creator?->user;
        $context = $this->context($payment);
        if ($user) {
            $this->mail->send(
                MailTemplateKey::InvoiceRejected,
                $user,
                $context,
                $payment,
                'rejected:'.($payment->reviewed_at?->timestamp ?? time()),
            );
        }

        $this->notifications->notifyCreator($payment->creator_id, [
            'title' => __('auth.finance_invoice_rejected_title'),
            'message' => __('auth.finance_invoice_rejected', [
                'work' => $context['nome_campanha'],
                'reason' => $payment->rejection_reason,
            ]),
            'type' => NotificationType::General,
            'link' => '/finance',
            'campaign_id' => $payment->campaign_id,
            'recurring_contract_id' => $payment->recurring_contract_id,
        ]);
    }

    public function paymentReleased(FinancePayment $payment): void
    {
        $payment->loadMissing(['creator.user', 'company', 'campaign', 'recurringContract']);
        $user = $payment->creator?->user;
        $context = $this->context($payment);
        $dateKey = $payment->payment_due_date?->toDateString() ?? 'none';
        if ($user) {
            $this->mail->send(
                MailTemplateKey::PaymentReleased,
                $user,
                $context,
                $payment,
                'released:'.$dateKey,
            );
        }

        $this->notifications->notifyCreator($payment->creator_id, [
            'title' => __('auth.finance_payment_released_title'),
            'message' => __('auth.finance_payment_released', [
                'work' => $context['nome_campanha'],
                'date' => $context['data_pagamento'],
            ]),
            'type' => NotificationType::General,
            'link' => '/finance',
            'campaign_id' => $payment->campaign_id,
            'recurring_contract_id' => $payment->recurring_contract_id,
        ]);
    }

    /**
     * @param  array<string, scalar|null>  $context
     */
    private function mailToCompany(
        User $user,
        Company $company,
        MailTemplateKey $key,
        array $context,
        FinancePayment $payment,
        string $occurrence,
    ): void {
        if ($user->company === null) {
            $user->setRelation('company', $company);
        }

        $this->mail->send($key, $user, $context, $payment, $occurrence);
    }

    /**
     * @return array<string, scalar|null>
     */
    private function context(FinancePayment $payment): array
    {
        $title = $payment->campaign?->name ?: $payment->recurringContract?->title;
        $month = $payment->reference_month?->locale(app()->getLocale())->isoFormat('MMMM YYYY');
        if ($payment->source === FinancePaymentSource::Coupon) {
            $title = __('auth.coupon_earning_title');
            if ($month) {
                $title .= ' ('.$month.')';
            }
        } elseif ($payment->source?->value === 'recurring' && $title && $month) {
            $title = $title.' ('.$month.')';
        }

        return [
            'nome_criador' => $payment->creator?->artistic_name ?: $payment->creator?->full_name,
            'nome_empresa' => $payment->company?->name,
            'nome_campanha' => $title,
            'data_limite' => $payment->invoice_due_date?->isoFormat('D MMM YYYY'),
            'data_pagamento' => $payment->payment_due_date?->isoFormat('D MMM YYYY'),
            'valor_campanha' => number_format((float) $payment->amount, 2, ',', '.').' '.($payment->currency ?: 'BRL'),
            'motivo_reprovacao' => $payment->rejection_reason,
            'cta_url' => FrontendUrl::to('/finance'),
            'link_plataforma' => FrontendUrl::to('/finance'),
            'campaign_id' => $payment->campaign_id,
            'company_id' => $payment->company_id,
            'creator_id' => $payment->creator_id,
        ];
    }

    private function matchesOffset(Carbon $date, int $offset): bool
    {
        return $date->copy()->startOfDay()->subDays($offset)->toDateString() === now()->toDateString();
    }
}
