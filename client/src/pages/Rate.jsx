// The client's page: opened from an email, no account, about 10 seconds.
// Built for a phone first: one column, big stars, one button.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { date, STAR_WORDS } from '../lib/format';
import { StarInput } from '../components/Stars';
import { Button, Loading, Notice, Textarea } from '../components/ui';
import { Logo } from '../components/Layout';

const CLOSED = {
  used: ['Already rated', 'This piece of work has already been rated. Thank you.'],
  replaced: ['This link was replaced', 'A newer rating link was sent for this work. Please use the latest email.'],
  expired: ['This link has expired', 'Ask the team that delivered the work to send a new link.'],
};

function Frame({ children }) {
  return (
    <div className="flex min-h-screen flex-col px-4 py-8 sm:items-center sm:justify-center">
      <div className="w-full max-w-md sm:rounded-panel sm:border sm:border-rule sm:bg-surface sm:p-8">{children}</div>
      <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted">
        <Logo className="text-base" />
        <span>keeps every rating exactly as it was given.</span>
      </p>
    </div>
  );
}

export default function Rate() {
  const { token } = useParams();
  const link = useApi(`/public/rate/${token}`);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  if (link.loading) return <Frame><Loading /></Frame>;
  if (link.error) {
    return (
      <Frame>
        <h1 className="text-2xl font-extrabold">This link doesn't work</h1>
        <p className="mt-3 text-muted">{link.error.message}</p>
      </Frame>
    );
  }
  const w = link.data;
  const first = w.employeeName.split(' ')[0];

  if (done) {
    return (
      <Frame>
        <div className="settle mb-6 text-cli">
          <StarRow n={done} />
        </div>
        <h1 className="text-2xl font-extrabold">Thank you</h1>
        <p className="mt-3 text-lg">
          Your {done}-star rating is now on {first}'s record. Nobody can change it, including {first}'s manager.
        </p>
        <p className="mt-6 text-muted">You can close this page.</p>
      </Frame>
    );
  }

  if (w.state !== 'ready') {
    const [title, text] = CLOSED[w.state];
    return (
      <Frame>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-3 text-muted">{text}</p>
      </Frame>
    );
  }

  const send = async (e) => {
    e.preventDefault();
    if (!score) return setError('Tap a star first.');
    setBusy(true);
    setError('');
    try {
      await api(`/public/rate/${token}`, { method: 'POST', body: { score, comment: comment || undefined } });
      setDone(score);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Frame>
      <p className="text-muted">{w.orgName} delivered this to you</p>
      <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">How was "{w.taskTitle}"?</h1>
      <p className="mt-3 text-lg">
        Built by <strong>{w.employeeName}</strong> for {w.projectName}.
      </p>
      {w.submission && (
        <p className="mt-2 break-words text-sm text-muted">
          Delivered: {/^https?:\/\//.test(w.submission) ? <a className="text-mgr underline" href={w.submission} target="_blank" rel="noreferrer">{w.submission}</a> : w.submission}
        </p>
      )}

      <form onSubmit={send} className="mt-8 flex flex-col gap-5">
        <StarInput value={score} onChange={setScore} size={52} tone="cli" label={`Rate ${first}'s work`} />
        {score > 0 && (
          <div>
            <label htmlFor="comment" className="text-sm font-semibold">
              Anything to add? <span className="font-normal text-muted">Optional</span>
            </label>
            <Textarea id="comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={score >= 4 ? 'What went well' : 'What could have been better'} />
          </div>
        )}
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" variant="client" size="lg" busy={busy} disabled={!score}>
          {score ? `Send ${score} star${score > 1 ? 's' : ''} – ${STAR_WORDS[score]}` : 'Send rating'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        No account needed. This link works once and expires on {date(w.expiresAt)}. {first}'s manager rated this work before it reached you, and cannot see or change your rating before it is saved.
      </p>
    </Frame>
  );
}

function StarRow({ n }) {
  return (
    <svg width={5 * 34} height="32" viewBox={`0 0 ${5 * 34} 32`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          transform={`translate(${i * 34} 2) scale(1.2)`}
          d="M12 2.8l2.84 5.76 6.36.92-4.6 4.48 1.08 6.33L12 17.3l-5.68 2.99 1.08-6.33-4.6-4.48 6.36-.92z"
          fill={i < n ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.4"
        />
      ))}
    </svg>
  );
}
