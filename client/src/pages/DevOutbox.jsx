// Development only: the emails FairView would have sent, with their links,
// so the client's rating page and invites can be tried without real email.
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { dateTime } from '../lib/format';
import { Button, Empty, LoadError, Loading, PageHeader, Row, Rows } from '../components/ui';
import { Logo } from '../components/Layout';

export default function DevOutbox() {
  const mail = useApi('/dev/outbox');
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Logo className="mb-8" />
      <PageHeader
        title="Dev outbox"
        intro="Emails the server would have sent. Only available in development (DEV_OUTBOX=true), never in production."
        actions={<Button variant="quiet" onClick={mail.reload}>Refresh</Button>}
      />
      {mail.loading && <Loading />}
      {mail.error && <LoadError error={mail.error} retry={mail.reload} />}
      {mail.data && mail.data.length === 0 && <Empty>No emails yet. Deliver a piece of work or invite someone.</Empty>}
      {mail.data && mail.data.length > 0 && (
        <Rows>
          {mail.data.map((m) => (
            <Row key={m.at + m.to}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{m.subject}</p>
                <p className="text-sm text-muted">{dateTime(m.at)}</p>
              </div>
              <p className="text-sm text-muted">To {m.to}</p>
              <div className="mt-3 flex gap-3">
                {m.ratingToken && <Link className="font-semibold text-cli underline underline-offset-4" to={`/rate/${m.ratingToken}`}>Open as the client</Link>}
                {m.inviteToken && <Link className="font-semibold text-mgr underline underline-offset-4" to={`/invite/${m.inviteToken}`}>Open the invite</Link>}
              </div>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-muted">Show email</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans">{m.text}</pre>
              </details>
            </Row>
          ))}
        </Rows>
      )}
    </div>
  );
}
