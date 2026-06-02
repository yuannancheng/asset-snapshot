import type { ReactNode } from "react";

type StatProps = {
  label: string;
  value: string;
  helper?: string;
  icon: ReactNode;
  iconTitle?: string;
  onIconClick?: () => void;
};

export function Stat({ label, value, helper, icon, iconTitle, onIconClick }: StatProps) {
  const iconClassName =
    "flex size-10 items-center justify-center rounded-md bg-mint text-moss transition focus:outline-none focus:ring-2 focus:ring-coral/40";

  return (
    <section className="rounded-lg border border-ink/10 bg-panel p-5 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink/60">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-ink">{value}</p>
        </div>
        {onIconClick ? (
          <button
            type="button"
            className={`${iconClassName} hover:bg-mint/70`}
            title={iconTitle}
            onClick={onIconClick}
          >
            {icon}
          </button>
        ) : (
          <div className={iconClassName}>{icon}</div>
        )}
      </div>
      {helper ? <p className="mt-4 text-sm text-ink/55">{helper}</p> : null}
    </section>
  );
}
