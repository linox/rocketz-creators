"use client";

import { InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  inputClassName?: string;
  iconClassName?: string;
};

export function PasswordField({
  inputClassName,
  iconClassName,
  className,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation("common");

  return (
    <div className={cn("relative", className)}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("h-11 w-full rounded-xl", inputClassName, "pr-12")}
      />
      <button
        type="button"
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600",
          iconClassName,
        )}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
