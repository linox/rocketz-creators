"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Select2Field, type Select2Option } from "@/components/Select2Field";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import {
  countryOptions,
  currencyOptions,
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  regionOptions,
} from "@/lib/geo";

type Theme = "light" | "dark";

function useGeoLocale() {
  const { i18n } = useTranslation();
  return intlLocale(normalizeLocale(i18n.language));
}

export function CountrySelect({
  theme = "light",
  value,
  onChange,
  placeholder,
  className,
  triggerClassName,
}: {
  theme?: Theme;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const locale = useGeoLocale();
  const options = useMemo<Select2Option[]>(() => countryOptions(locale), [locale]);

  return (
    <Select2Field
      theme={theme}
      searchable
      placeholder={placeholder}
      value={value}
      options={options}
      onChange={onChange}
      className={className}
      triggerClassName={triggerClassName}
    />
  );
}

export function RegionSelect({
  theme = "light",
  country,
  value,
  onChange,
  placeholder,
  className,
  triggerClassName,
  disabled,
}: {
  theme?: Theme;
  country: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const locale = useGeoLocale();
  const options = useMemo<Select2Option[]>(() => regionOptions(country || DEFAULT_COUNTRY, locale), [country, locale]);

  return (
    <Select2Field
      theme={theme}
      searchable
      disabled={disabled || options.length === 0}
      placeholder={placeholder}
      value={value}
      options={options}
      onChange={onChange}
      className={className}
      triggerClassName={triggerClassName}
    />
  );
}

export function CurrencySelect({
  theme = "light",
  value,
  onChange,
  placeholder,
  className,
  triggerClassName,
}: {
  theme?: Theme;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const locale = useGeoLocale();
  const options = useMemo<Select2Option[]>(() => currencyOptions(locale), [locale]);

  return (
    <Select2Field
      theme={theme}
      searchable
      placeholder={placeholder}
      value={value || DEFAULT_CURRENCY}
      options={options}
      onChange={onChange}
      className={className}
      triggerClassName={triggerClassName}
    />
  );
}
