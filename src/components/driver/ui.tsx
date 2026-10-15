/** BoxHauls Driver: shared UI pieces (same tokens as the customer site). */
import type { ReactNode } from 'react';

export const inputCls = 'mt-1 w-full rounded-md border-2 border-border bg-surface px-3 py-3 text-ink outline-none focus:border-ink focus:bg-bg';
export const primaryBtn = 'display w-full rounded-md bg-brand px-6 py-4 text-lg text-inverse active:scale-[0.99] disabled:bg-border-strong';
export const darkBtn = 'display w-full rounded-md bg-ink px-6 py-4 text-lg text-inverse active:scale-[0.99] disabled:bg-border-strong';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Full-height light screen with a back arrow, like Uber's settings and document screens. */
export function Screen({ title, onBack, children, footer }: { title: string; onBack?: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <header className="flex items-center gap-3 border-b border-border px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        {onBack && (
          <button onClick={onBack} aria-label="Back" className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        <h1 className="text-xl">{title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      {footer && <div className="border-t border-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="mt-3 text-sm font-semibold text-brand" role="alert">{children}</p> : null;
}

export function Chevron() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>;
}

export function Logo({ dark = true, className = 'h-9 w-auto' }: { dark?: boolean; className?: string }) {
  return <img src={dark ? '/brand/wordmark-on-dark.png' : '/brand/wordmark.png'} alt="BoxHauls" width={183} height={44} className={className} />;
}
