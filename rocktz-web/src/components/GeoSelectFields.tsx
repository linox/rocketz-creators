"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Select2Field, type Select2Option } from "@/components/Select2Field";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import {
  countryOptions,
  currencyOptions,
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
  emptyLabel,
}: {
  theme?: Theme;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  emptyLabel?: string;
}) {
  const locale = useGeoLocale();
  const options = useMemo<Select2Option[]>(() => {
    const list = countryOptions(locale);
    return emptyLabel ? [{ value: "all", label: emptyLabel }, ...list] : list;
  }, [locale, emptyLabel]);

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
  emptyLabel,
}: {
  theme?: Theme;
  country: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const locale = useGeoLocale();
  const options = useMemo<Select2Option[]>(() => {
    const list = country && country !== "all" ? regionOptions(country, locale) : [];
    return emptyLabel ? [{ value: "all", label: emptyLabel }, ...list] : list;
  }, [country, locale, emptyLabel]);

  return (
    <Select2Field
      theme={theme}
      searchable
      disabled={disabled || options.filter((option) => option.value !== "all").length === 0}
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
