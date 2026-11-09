<?php

namespace App\Support;

use App\Enums\CouponChangeStatus;
use App\Models\CreatorCoupon;
use Illuminate\Support\Collection;

class CreatorCouponExport
{
    /**
     * @param  Collection<int, CreatorCoupon>  $coupons
     */
    public static function csv(Collection $coupons): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            return '';
        }

        fwrite($handle, "\xEF\xBB\xBF");
        $headers = ['code', 'creator', 'company', 'campaign', 'discount', 'commission', 'status', 'suggested_code', 'created_at'];
        fputcsv($handle, array_map(fn (string $key) => __('coupons.csv.'.$key), $headers), ';');

        foreach ($coupons as $coupon) {
            $creator = $coupon->creator;
            $pending = $coupon->change_status === CouponChangeStatus::Pending;
            fputcsv($handle, [
                self::cell($coupon->code),
                self::cell($creator?->artistic_name ?: $creator?->full_name),
                self::cell($coupon->company?->name),
                self::cell($coupon->campaign?->name ?: __('coupons.csv.manual')),
                self::percent($coupon->discount_percent),
                self::percent($coupon->commission_percent),
                $coupon->is_active ? __('coupons.csv.active') : __('coupons.csv.paused'),
                self::cell($pending ? $coupon->suggested_code : ''),
                self::cell($coupon->created_at?->timezone(config('app.timezone'))->format(
                    app()->getLocale() === 'en' ? 'Y-m-d H:i' : 'd/m/Y H:i'
                )),
            ], ';');
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv === false ? '' : $csv;
    }

    private static function percent(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $number = (float) $value;
        $decimals = abs($number - round($number)) < 0.001 ? 0 : 2;
        $separator = app()->getLocale() === 'en' ? '.' : ',';

        return number_format($number, $decimals, $separator, '');
    }

    private static function cell(mixed $value): string
    {
        $text = trim((string) $value);
        if ($text !== '' && preg_match('/^[=+\-@\t\r]/', $text) === 1) {
            return "'".$text;
        }

        return $text;
    }
}
