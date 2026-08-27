"use client";

import type { InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { currencySymbol, resolveCurrency } from "@/lib/geo";
import { formatMoneyMask, moneyPlaceholder } from "@/lib/masks";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  currency?: string | null;
};

export function MoneyInput({ value, onChange, currency, className, placeholder, ...rest }: MoneyInputProps) {
  const { i18n } = useTranslation();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const code = resolveCurrency(currency);
  const symbol = currencySymbol(code, locale);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 z-[1] -translate-y-1/2 text-xs font-bold text-slate-400">
        {symbol}
      </span>
      <input
        {...rest}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder ?? moneyPlaceholder(code)}
        className={cn("tabular-nums", className, "pl-11")}
        value={value}
        onChange={(event) => onChange(formatMoneyMask(event.target.value, code))}
      />
    </div>
  );
}
