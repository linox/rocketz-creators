import type { ReactNode } from "react";

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="text-[12px] font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
      <span className="text-2xl font-black text-slate-950">{value}</span>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-black text-slate-950 sm:text-2xl md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end [&>*]:min-h-11 [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div> : null}
    </div>
  );
}
