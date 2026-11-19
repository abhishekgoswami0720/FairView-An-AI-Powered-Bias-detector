import { useEffect, useId, useRef } from 'react';

const cx = (...c) => c.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size = 'md', className, busy, children, ...props }) {
  const styles = {
    primary: 'bg-ink text-white hover:bg-ink/90 disabled:bg-ink/40',
    manager: 'bg-mgr text-white hover:bg-mgr/90 disabled:bg-mgr/40',
    client: 'bg-cli text-white hover:bg-cli/90 disabled:bg-cli/40',
    quiet: 'bg-surface text-ink border border-rule hover:border-ink/40 disabled:text-muted',
    link: 'text-mgr underline underline-offset-4 hover:text-ink px-0',
    danger: 'bg-surface text-bad border border-bad/40 hover:bg-bad-soft',
  };
  const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4', lg: 'h-14 px-6 text-lg' };
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed',
        variant !== 'link' && sizes[size],
        styles[variant],
        className
      )}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}

export function Field({ label, hint, error, children }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-sm text-muted">{hint}</p>}
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded-control border border-rule bg-surface px-3 py-2 text-base placeholder:text-muted/70 focus:border-mgr focus:outline-none';

export const Input = (props) => <input className={inputClass} {...props} />;
export const Textarea = (props) => <textarea className={cx(inputClass, 'min-h-20')} {...props} />;
export const Select = ({ children, ...props }) => (
  <select className={cx(inputClass, 'h-10 py-0')} {...props}>
    {children}
  </select>
);

export function Notice({ tone = 'info', children, className }) {
  const tones = {
    info: 'bg-mgr-soft text-ink',
    good: 'bg-cli-soft text-ink',
    look: 'bg-look-soft text-ink',
    bad: 'bg-bad-soft text-bad',
  };
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cx('rounded-control px-4 py-3', tones[tone], className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, intro, actions }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {intro && <p className="mt-2 text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, aside, children, className }) {
  return (
    <section className={cx('mb-10', className)}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          {aside && <div className="text-sm text-muted">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// A list of rows on one white panel, separated by thin rules.
export function Rows({ children }) {
  return <ul className="divide-y divide-rule overflow-hidden rounded-panel border border-rule bg-surface">{children}</ul>;
}

export function Row({ children, className }) {
  return <li className={cx('px-4 py-4 sm:px-5', className)}>{children}</li>;
}

export function Empty({ children }) {
  return <p className="rounded-panel border border-dashed border-rule px-5 py-8 text-center text-muted">{children}</p>;
}

export function Badge({ tone = 'plain', children }) {
  const tones = {
    plain: 'bg-paper text-muted',
    mgr: 'bg-mgr-soft text-mgr',
    cli: 'bg-cli-soft text-cli',
    look: 'bg-look-soft text-look',
    bad: 'bg-bad-soft text-bad',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold', tones[tone])}>{children}</span>;
}

export function Loading() {
  return <p className="py-10 text-muted">Loading…</p>;
}

export function LoadError({ error, retry }) {
  return (
    <Notice tone="bad">
      {error.message}{' '}
      {retry && (
        <button className="font-semibold underline" onClick={retry}>
          Try again
        </button>
      )}
    </Notice>
  );
}

// A dialog that traps nothing fancy: Escape or the backdrop closes it.
export function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-panel bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded px-2 text-2xl leading-none text-muted hover:text-ink" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
