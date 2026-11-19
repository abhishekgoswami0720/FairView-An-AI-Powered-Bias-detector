import { useApi } from '../../lib/useApi';
import { gapWords, stars } from '../../lib/format';
import { Pair, PairLegend, PairNumbers } from '../../components/Pair';
import { Empty, LoadError, Loading, PageHeader, Row, Rows, Section } from '../../components/ui';

export default function Team() {
  const team = useApi('/insights/team');
  if (team.loading) return <Loading />;
  if (team.error) return <LoadError error={team.error} retry={team.reload} />;
  const { overall, people } = team.data;

  return (
    <>
      <PageHeader
        title="My team"
        intro="Your ratings next to the clients' ratings of the same work, person by person. If one person's gap is very different from everyone else's, it's worth a second look before appraisal."
      />
      <p className="mb-10 max-w-2xl text-lg">
        {overall.n === 0
          ? 'No work has been rated by both you and a client yet.'
          : <>Across {overall.n} pieces of work rated by both sides, you rate <strong>{gapWords(overall.meanGap)}</strong> on average ({stars(overall.managerAvg)} vs {stars(overall.clientAvg)}).</>}
      </p>
      <Section title="By person" aside={<PairLegend />}>
        {people.length === 0 ? <Empty>No one on your projects yet.</Empty> : (
          <Rows>
            {people.map((p) => (
              <Row key={p.id} className="grid items-center gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <p className="font-semibold">{p.name}{!p.active && <span className="text-muted"> (left)</span>}</p>
                  <p className="text-sm text-muted">
                    {p.n === 0 ? 'Nothing rated by both sides yet' : `${p.n} pieces of work, you rate ${gapWords(p.meanGap)}`}
                  </p>
                </div>
                <PairNumbers manager={p.managerAvg} client={p.clientAvg} />
                <Pair manager={p.managerAvg} client={p.clientAvg} title={p.name} />
              </Row>
            ))}
          </Rows>
        )}
      </Section>
    </>
  );
}
