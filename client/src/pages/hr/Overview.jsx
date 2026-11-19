import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { dateTime, gapWords, percent } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { Pair, PairLegend, PairNumbers } from '../../components/Pair';
import { Button, Empty, LoadError, Loading, Notice, PageHeader, Row, Rows, Section } from '../../components/ui';

function AnalysisStatus({ analysis, onRun, busy }) {
  const s = analysis?.lastStatus;
  const text = !s
    ? 'The gap analysis has not run yet.'
    : s === 'ok'
      ? `Last analysis ${dateTime(analysis.lastRunAt)}, over ${analysis.pairsAnalysed} pieces of work rated by both sides.`
      : s === 'disabled'
        ? 'The gap analysis is switched off (no ML service is configured).'
        : `The last analysis failed: ${analysis.lastError}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={s === 'failed' ? 'text-bad' : 'text-muted'}>{text}</p>
      <Button size="sm" variant="quiet" busy={busy} onClick={onRun}>Run analysis now</Button>
    </div>
  );
}

export default function Overview() {
  const toast = useToast();
  const ov = useApi('/insights/overview');
  const [busy, setBusy] = useState(false);
  if (ov.loading && !ov.data) return <Loading />;
  if (ov.error) return <LoadError error={ov.error} retry={ov.reload} />;
  const o = ov.data;
  const rate = o.last90Days.clientRatingRate;

  const run = async () => {
    setBusy(true);
    try {
      const r = await api('/gap-cards/analyse', { method: 'POST' });
      toast(r.status === 'ok' ? `Analysis done. ${r.cardsCreated} new Gap Card${r.cardsCreated === 1 ? '' : 's'}.` : `Analysis ${r.status}: ${r.error || 'no ML service configured'}`, r.status === 'ok' ? 'good' : 'bad');
      ov.reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title={o.orgName} intro={`${o.people.employee} employees, ${o.people.manager} managers.`} />

      <div className="mb-10 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-panel border border-rule bg-surface p-6">
          <p className="text-xl leading-relaxed">
            {o.last90Days.delivered === 0 ? (
              'No work has been delivered in the last 90 days.'
            ) : (
              <>In the last 90 days, clients rated <strong>{o.last90Days.clientRated}</strong> of <strong>{o.last90Days.delivered}</strong> delivered pieces of work: <strong className="text-cli">{percent(rate)}</strong>.</>
            )}
          </p>
          {rate != null && rate < 0.4 && (
            <Notice tone="look" className="mt-4">
              Below 40%, there is too little client feedback to compare. Ask managers to mention the rating email in sprint demos.
            </Notice>
          )}
        </div>
        <Link
          to="/hr/gap-cards"
          className={`flex flex-col justify-between rounded-panel border p-6 hover:border-ink/40 ${o.gapCards.open ? 'border-look/40 bg-look-soft' : 'border-rule bg-surface'}`}
        >
          <p className="text-xl font-bold">{o.gapCards.open === 0 ? 'No open Gap Cards' : `${o.gapCards.open} Gap Card${o.gapCards.open > 1 ? 's' : ''} worth a look`}</p>
          <p className="mt-2 text-muted">{o.gapCards.reviewed} reviewed so far. Open the list</p>
        </Link>
      </div>

      <Section className="rounded-panel border border-rule bg-surface px-5 py-4">
        <AnalysisStatus analysis={o.analysis} onRun={run} busy={busy} />
      </Section>

      <Section title="Managers compared with clients" aside={<PairLegend />}>
        <p className="mb-4 max-w-2xl text-muted">
          A manager who is strict or generous with everyone is a calibration question. Gap Cards look for something else: one person rated very differently from how clients see their work.
        </p>
        {o.managers.length === 0 ? <Empty>No managers yet. Add them on the People page.</Empty> : (
          <Rows>
            {o.managers.map((m) => (
              <Row key={m.id} className="grid items-center gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <p className="font-semibold">{m.name}{!m.active && <span className="text-muted"> (left)</span>}</p>
                  <p className="text-sm text-muted">{m.n === 0 ? 'Nothing rated by both sides yet' : `${m.n} pieces of work, rates ${gapWords(m.meanGap)}`}</p>
                </div>
                <PairNumbers manager={m.managerAvg} client={m.clientAvg} />
                <Pair manager={m.managerAvg} client={m.clientAvg} title={m.name} />
              </Row>
            ))}
          </Rows>
        )}
      </Section>
    </>
  );
}
