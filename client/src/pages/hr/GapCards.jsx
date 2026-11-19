import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { date, gapWords, OUTCOME_LABEL, shortDate, stars } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { Pair, PairLegend } from '../../components/Pair';
import { Badge, Button, Empty, Field, LoadError, Loading, Notice, PageHeader, Row, Rows, Section, Select, Textarea } from '../../components/ui';

function headline(card) {
  const s = card.latest || card.snapshot;
  const verb = s.direction === 'lower' ? 'lower' : 'higher';
  return `${card.manager.name} rates ${card.employee.name} ${verb} than clients do, unlike the rest of the team`;
}

export function GapCardList() {
  const [status, setStatus] = useState('open');
  const cards = useApi(`/gap-cards?status=${status}`);
  return (
    <>
      <PageHeader
        title="Gap Cards"
        intro="A card appears when one manager's ratings of one person keep landing far from the clients' ratings of the same work. It is a reason to ask, never a verdict."
      />
      <div role="tablist" aria-label="Card status" className="mb-6 inline-flex rounded-control border border-rule bg-surface p-1">
        {['open', 'reviewed'].map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-md px-4 py-1.5 font-semibold ${status === s ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
          >
            {s === 'open' ? 'Worth a look' : 'Reviewed'}
          </button>
        ))}
      </div>
      {cards.loading && <Loading />}
      {cards.error && <LoadError error={cards.error} retry={cards.reload} />}
      {cards.data && (cards.data.length === 0 ? (
        <Empty>{status === 'open' ? 'No open cards. Managers’ ratings are in line with what clients see.' : 'No reviewed cards yet.'}</Empty>
      ) : (
        <Rows>
          {cards.data.map((c) => {
            const s = c.latest || c.snapshot;
            return (
              <Row key={c._id} className="grid items-center gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <Link to={`/hr/gap-cards/${c._id}`} className="font-semibold underline-offset-4 hover:underline">{headline(c)}</Link>
                  <p className="text-sm text-muted">
                    {s.n} pieces of work. Raised {date(c.createdAt)}
                    {c.review?.outcome && `. ${OUTCOME_LABEL[c.review.outcome]}`}
                  </p>
                </div>
                <Pair manager={s.managerAvg} client={s.clientAvg} title={`${c.manager.name} and clients on ${c.employee.name}`} />
              </Row>
            );
          })}
        </Rows>
      ))}
    </>
  );
}

const Square = (props) => <rect x={props.cx - 5} y={props.cy - 5} width="10" height="10" rx="2" fill="var(--color-mgr)" />;
const Ring = (props) => <circle cx={props.cx} cy={props.cy} r="5" fill="var(--color-surface)" stroke="var(--color-cli)" strokeWidth="2.5" />;

export function GapCardDetail() {
  const { id } = useParams();
  const res = useApi(`/gap-cards/${id}`);
  if (res.loading && !res.data) return <Loading />;
  if (res.error) return <LoadError error={res.error} retry={res.reload} />;
  const { card, current, ratings } = res.data;
  const s = card.snapshot;
  const first = card.employee.name.split(' ')[0];
  const chart = ratings.map((r, i) => ({ i: i + 1, when: shortDate(r.ratedAt), manager: r.managerScore, client: r.clientScore, title: r.title }));

  return (
    <>
      <p className="mb-2"><Link to="/hr/gap-cards" className="text-sm font-semibold text-mgr underline underline-offset-4">All Gap Cards</Link></p>
      <PageHeader title={`${card.manager.name} and ${card.employee.name}`} intro={`Raised ${date(card.createdAt)}. ${card.status === 'open' ? 'Worth a look.' : 'Reviewed.'}`} />

      <div className="mb-10 grid gap-6 rounded-panel border border-look/40 bg-surface p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="max-w-2xl space-y-3 text-lg leading-relaxed">
          <p>
            On the same {current.pair.n} pieces of work, <strong className="text-mgr">{card.manager.name} gives {first} {stars(current.pair.managerAvg)} stars</strong> on average.{' '}
            <strong className="text-cli">Clients give {stars(current.pair.clientAvg)}</strong>.
          </p>
          <p>
            With the rest of the team, {card.manager.name.split(' ')[0]} rates {gapWords(current.rest.meanGap)} ({current.rest.n} pieces of work). With {first}: {gapWords(current.pair.meanGap)}.
          </p>
          <p className="text-base text-muted">
            The ratings came from {current.distinctClients} client contact{current.distinctClients === 1 ? '' : 's'}. When raised, this gap scored z = {s.z?.toFixed(1)} (cards appear from ±2.5)
            {s.patternScore != null && `, and its pattern scored ${s.patternScore.toFixed(2)} on the unusualness check (about 0.5 is ordinary)`}.
          </p>
        </div>
        <Pair manager={current.pair.managerAvg} client={current.pair.clientAvg} size="lg" title="Averages" />
      </div>

      <Section title="Every rating, in order" aside={<PairLegend />}>
        <div className="mb-4 h-64 rounded-panel border border-rule bg-surface p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid stroke="var(--color-rule)" vertical={false} />
              <XAxis dataKey="when" tick={{ fontSize: 12, fill: 'var(--color-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--color-rule)' }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v, name) => [`${v} stars`, name === 'manager' ? card.manager.name : 'Client']} labelFormatter={(_, p) => p?.[0]?.payload?.title || ''} />
              <Line type="linear" dataKey="manager" stroke="var(--color-mgr)" strokeWidth={2} dot={<Square />} isAnimationActive={false} />
              <Line type="linear" dataKey="client" stroke="var(--color-cli)" strokeWidth={2} strokeDasharray="5 4" dot={<Ring />} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Rows>
          {ratings.map((r) => (
            <Row key={r.taskId} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-muted">{r.project}, rated by {r.clientName} ({r.clientEmail}) on {date(r.ratedAt)}</p>
                {r.managerComment && <p className="mt-1 text-sm"><span className="font-semibold text-mgr">Manager:</span> "{r.managerComment}"</p>}
                {r.clientComment && <p className="mt-1 text-sm"><span className="font-semibold text-cli">Client:</span> "{r.clientComment}"</p>}
              </div>
              <Pair manager={r.managerScore} client={r.clientScore} />
            </Row>
          ))}
        </Rows>
      </Section>

      <Section title="What a gap does not prove">
        <ul className="max-w-2xl list-disc space-y-1 pl-5 text-muted">
          <li>The manager may know things the client doesn't see: missed deadlines, help from teammates, code quality behind the scenes.</li>
          <li>Clients can be biased too. Check whether the ratings come from one client contact or several.</li>
          <li>It says nothing about who gets which work. Ask about that separately.</li>
        </ul>
      </Section>

      {card.status === 'open' ? <ReviewForm card={card} onDone={res.reload} /> : (
        <Notice tone="good">
          Reviewed by {card.review.by?.name} on {date(card.review.at)}: <strong>{OUTCOME_LABEL[card.review.outcome]}</strong>.
          {card.review.note && <> "{card.review.note}"</>}
        </Notice>
      )}
    </>
  );
}

function ReviewForm({ card, onDone }) {
  const toast = useToast();
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/gap-cards/${card._id}/review`, { method: 'POST', body: { outcome, note: note || undefined } });
      toast('Review saved.');
      onDone();
    } catch (err) {
      toast(err.message, 'bad');
      setBusy(false);
    }
  };
  return (
    <Section title="Record your review">
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-4 rounded-panel border border-rule bg-surface p-5">
        <Field label="What did you find?">
          {(id) => (
            <Select id={id} required value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">Choose one</option>
              {Object.entries(OUTCOME_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Note" hint="Optional. Kept with the card.">{(id) => <Textarea id={id} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        <div className="flex items-center gap-3">
          <Button type="submit" busy={busy}>Save review</Button>
          <Badge tone="look">The card's numbers stay as they are</Badge>
        </div>
      </form>
    </Section>
  );
}

