import { STAR_WORDS } from '../lib/format';

const StarShape = ({ filled, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2.8l2.84 5.76 6.36.92-4.6 4.48 1.08 6.33L12 17.3l-5.68 2.99 1.08-6.33-4.6-4.48 6.36-.92z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

// Choosing 1-5 stars. Works with a mouse, a finger, or the arrow keys (it is a radio group).
export function StarInput({ value, onChange, size = 40, tone = 'mgr', label = 'Your rating' }) {
  const color = tone === 'cli' ? 'text-cli' : 'text-mgr';
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, (value || 0) + 1));
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(1, (value || 2) - 1));
    }
  };
  return (
    <div>
      <div role="radiogroup" aria-label={label} className={`flex gap-1 ${color}`} onKeyDown={onKey}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}: ${STAR_WORDS[n]}`}
            tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
            onClick={() => onChange(n)}
            className={`rounded-md p-1 transition-transform hover:scale-110 ${value >= n ? '' : 'opacity-35'}`}
          >
            <StarShape filled={value >= n} size={size} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-6 text-sm font-semibold text-muted" aria-live="polite">
        {value ? `${value} – ${STAR_WORDS[value]}` : ''}
      </p>
    </div>
  );
}
