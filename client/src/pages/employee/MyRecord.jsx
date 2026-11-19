import { useApi } from '../../lib/useApi';
import { date, stars } from '../../lib/format';
import { Pair, PairLegend } from '../../components/Pair';
import { Empty, LoadError, Loading, PageHeader, Row, Rows, Section } from '../../components/ui';

export default function MyRecord() {
  const record = useApi('/insights/record');
  if (record.loading) return <Loading />;
  if (record.error) return <LoadError error={record.error} retry={record.reload} />;
  const { summary, work } = record.data;

  return (
    <>
      <PageHeader
        title="My record"
        intro="What clients said about the work you delivered. These ratings are locked: nobody can change them, including your manager."
      />
      <div className="mb-10 grid gap-6 rounded-panel border border-rule bg-surface p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <p className="text-xl leading-relaxed">
          {summary.clientRated === 0 ? (
            'No client ratings yet. They appear here as soon as a client rates your work.'
          ) : (
            <>
              Clients rated <strong>{summary.clientRated}</strong> of your {summary.delivered} delivered pieces of work, <strong className="text-cli">{stars(summary.clientAvg)} stars</strong> on average.
              {summary.managerAvg != null && <> Your manager's average on the same work: <strong className="text-mgr">{stars(summary.managerAvg)}</strong>.</>}
            </>
          )}
        </p>
        {summary.clientRated > 0 && <Pair manager={summary.managerAvg} client={summary.clientAvg} size="lg" title="Your averages" />}
      </div>

      <Section title="Delivered work" aside={<PairLegend />}>
        {work.length === 0 ? <Empty>Delivered work will show up here.</Empty> : (
          <Rows>
            {work.map((w) => (
              <Row key={w._id} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-semibold">{w.title}</p>
                  <p className="text-sm text-muted">
                    {w.project?.name}, delivered {date(w.deliveredAt)}
                  </p>
                  {w.ratings.client?.comment && <p className="mt-2 text-sm"><span className="font-semibold text-cli">Client:</span> "{w.ratings.client.comment}"</p>}
                  {w.ratings.manager?.comment && <p className="mt-1 text-sm"><span className="font-semibold text-mgr">Manager:</span> "{w.ratings.manager.comment}"</p>}
                  {!w.ratings.revealed && <p className="mt-1 text-sm text-muted">Waiting for the client. Both ratings appear together once they rate.</p>}
                </div>
                <Pair manager={w.ratings.manager?.score} client={w.ratings.client?.score} hidden={!w.ratings.revealed} />
              </Row>
            ))}
          </Rows>
        )}
      </Section>
    </>
  );
}
