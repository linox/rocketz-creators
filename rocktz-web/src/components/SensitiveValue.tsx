"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type MouseEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { maskSensitive, type SensitiveKind } from "@/lib/mask-sensitive";

function RevealButton({
  shown,
  tone,
  onClick,
}: {
  shown: boolean;
  tone: "light" | "dark";
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useTranslation("common");
  return (
    <button
      type="button"
      aria-pressed={shown}
      aria-label={shown ? t("sensitiveHide") : t("sensitiveShow")}
      title={shown ? t("sensitiveHide") : t("sensitiveShow")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md p-1",
        tone === "dark" ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
      )}
    >
      {shown ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}

export function SensitiveText({
  value,
  kind = "text",
  preview,
  empty = "—",
  className,
  multiline = false,
  forceHidden = false,
  href,
  tone = "light",
}: {
  value?: string | null;
  kind?: SensitiveKind;
  preview?: string | null;
  empty?: string;
  className?: string;
  multiline?: boolean;
  forceHidden?: boolean;
  href?: string;
  tone?: "light" | "dark";
}) {
  const [shown, setShown] = useState(false);
  const text = (value ?? "").trim();
  if (!text) {
    return <span className={className}>{empty}</span>;
  }
  const hiddenText = forceHidden ? "••••••••" : (preview?.trim() || maskSensitive(text, kind));
  const display = shown ? text : hiddenText;
  const body = shown && href ? (
    <a href={href} className="min-w-0 break-all underline-offset-2 hover:underline">{display}</a>
  ) : (
    <span className={cn("min-w-0 break-all", multiline && "whitespace-pre-line")}>{display}</span>
  );

  return (
    <span className={cn("inline-flex max-w-full items-start gap-1", className)}>
      {body}
      <RevealButton shown={shown} tone={tone} onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setShown((current) => !current);
      }} />
    </span>
  );
}

type SensitiveInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  kind?: SensitiveKind;
  type?: "text" | "email" | "date";
  tone?: "light" | "dark";
};

export function SensitiveInput({
  value,
  onChange,
  kind = "text",
  type = "text",
  tone = "light",
  className,
  disabled,
  maxLength,
  autoComplete,
  onFocus,
  ...rest
}: SensitiveInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previous = useRef(value);
  const [shown, setShown] = useState(false);
  const fieldId = useId();
  const hasValue = value.trim() !== "";
  const conceal = hasValue && !shown;

  useEffect(() => {
    if (previous.current !== value && inputRef.current !== document.activeElement) {
      setShown(false);
    }
    previous.current = value;
  }, [value]);

  return (
    <div className="relative">
      <input
        {...rest}
        ref={inputRef}
        id={rest.id || fieldId}
        type={conceal ? "text" : type}
        value={conceal ? maskSensitive(value, kind) : value}
        readOnly={conceal || disabled}
        aria-disabled={disabled || undefined}
        maxLength={conceal ? undefined : maxLength}
        autoComplete={conceal ? "off" : autoComplete}
        spellCheck={conceal ? false : rest.spellCheck}
        onFocus={(event) => {
          if (!value.trim()) setShown(true);
          onFocus?.(event);
        }}
        onChange={(event) => {
          if (conceal || disabled) return;
          if (!shown) setShown(true);
          onChange(event.target.value);
        }}
        className={cn(className, "pr-10", disabled && "cursor-default opacity-80")}
      />
      {hasValue ? (
        <span className="absolute top-1/2 right-1.5 -translate-y-1/2">
          <RevealButton shown={shown} tone={tone} onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setShown((current) => !current);
          }} />
        </span>
      ) : null}
    </div>
  );
}
