import type { ReactNode } from "react";

type StatProps = {
  label: string;
  value: string;
  helper?: string;
  icon: ReactNode;
};

export function Stat({ label, value, helper, icon }: StatProps) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink/60">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-ink">{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-md bg-mint text-moss">
          {icon}
        </div>
      </div>
      {helper ? <p className="mt-4 text-sm text-ink/55">{helper}</p> : null}
    </section>
  );
}
