"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type Props = {
  children: ReactNode;
  onClose: () => void;
  panelClassName?: string;
  zIndexClassName?: string;
  lockBackdrop?: boolean;
};

export function AppModal({
  children,
  onClose,
  panelClassName,
  zIndexClassName = "z-[100]",
  lockBackdrop = false,
}: Props) {
  const { t: tc } = useTranslation("common");

  return (
    <div className={cn("app-modal-overlay fixed inset-0 flex items-center justify-center overflow-y-auto p-3 sm:p-4", zIndexClassName)}>
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (lockBackdrop) return;
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        aria-label={tc("close")}
      />
      <div className={cn("app-modal-panel relative z-10 my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl", panelClassName)}>
        {children}
      </div>
    </div>
  );
}
