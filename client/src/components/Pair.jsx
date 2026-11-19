// The paired rating: the manager's mark (indigo square) and the client's mark (teal ring)
// on the same 1-5 scale, joined by a line whose length is the gap between them.
// Shape and position carry the meaning, so it reads without colour too.
const W = 132;
const H = 28;
const PAD = 10;
const x = (stars) => PAD + ((stars - 1) / 4) * (W - 2 * PAD);

export function Pair({ manager, client, hidden = false, size = 'md', title }) {
  const scale = size === 'lg' ? 1.6 : 1;
  const same = manager != null && client != null && Math.abs(manager - client) < 0.05;
  const label = hidden
    ? 'Ratings hidden until both are in'
    : [manager != null && `Manager ${Number(manager).toFixed(1)} stars`, client != null && `Client ${Number(client).toFixed(1)} stars`].filter(Boolean).join(', ') || 'Not rated yet';
  return (
    <svg
      width={W * scale}
      height={H * scale}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={title ? `${title}: ${label}` : label}
      className="shrink-0 overflow-visible"
    >
      <line x1={x(1)} x2={x(5)} y1={H / 2} y2={H / 2} stroke="var(--color-rule)" strokeWidth="2" strokeLinecap="round" />
      {[1, 2, 3, 4, 5].map((s) => (
        <line key={s} x1={x(s)} x2={x(s)} y1={H / 2 - 3} y2={H / 2 + 3} stroke="var(--color-rule)" strokeWidth="1.5" />
      ))}
      {hidden ? (
        <text x={W / 2} y={H / 2 - 6} textAnchor="middle" fontSize="9" fill="var(--color-muted)">
          hidden until both are in
        </text>
      ) : (
        <>
          {manager != null && client != null && (
            <line x1={x(manager)} x2={x(client)} y1={H / 2} y2={H / 2} stroke="var(--color-ink)" strokeWidth="2.5" />
          )}
          {client != null && <circle cx={x(client)} cy={H / 2} r={same ? 7.5 : 5.6} fill="var(--color-surface)" stroke="var(--color-cli)" strokeWidth="3" />}
          {/* Drawn after the ring, and smaller when both agree, so the square shows inside the ring. */}
          {manager != null && (
            <rect x={x(manager) - (same ? 3.5 : 5.5)} y={H / 2 - (same ? 3.5 : 5.5)} width={same ? 7 : 11} height={same ? 7 : 11} rx="1.5" fill="var(--color-mgr)" />
          )}
        </>
      )}
    </svg>
  );
}

export function PairLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
      <span className="inline-flex items-center gap-2">
        <svg width="12" height="12" aria-hidden="true"><rect width="11" height="11" x=".5" y=".5" rx="2" fill="var(--color-mgr)" /></svg>
        Manager
      </span>
      <span className="inline-flex items-center gap-2">
        <svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--color-cli)" strokeWidth="3" /></svg>
        Client
      </span>
      <span>Scale: 1 to 5 stars, left to right</span>
    </p>
  );
}

// Numbers next to the marks, for rows that show both.
export function PairNumbers({ manager, client }) {
  return (
    <span className="inline-flex gap-3 text-sm tabular-nums">
      <span className="font-semibold text-mgr">{manager == null ? '–' : Number(manager).toFixed(1)}</span>
      <span className="font-semibold text-cli">{client == null ? '–' : Number(client).toFixed(1)}</span>
    </span>
  );
}
