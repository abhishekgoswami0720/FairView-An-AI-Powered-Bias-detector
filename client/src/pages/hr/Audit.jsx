import { useState } from 'react';
import { useApi } from '../../lib/useApi';
import { dateTime } from '../../lib/format';
import { Badge, Empty, LoadError, Loading, PageHeader, Row, Rows } from '../../components/ui';

// Plain-words names for the actions in the log.
const ACTION = {
  'org.create': 'created the company',
  'user.invite': 'invited a person',
  'user.invite.resend': 'resent an invite',
  'user.invite.accept': 'joined',
  'user.update': 'changed a person',
  'project.create': 'created a project',
  'project.client.change': 'changed a client contact',
  'project.closed': 'closed a project',
  'project.active': 'reopened a project',
  'task.create': 'assigned work',
  'task.in_progress': 'started work',
  'task.submitted': 'submitted work',
  'task.rework': 'sent work back for rework',
  'task.deliver': 'delivered work to the client',
  'ratinglink.resend': 'resent a rating link',
  'rating.manager.create': 'gave a manager rating',
  'rating.client.create': 'gave a client rating',
  'gapcard.create': 'raised a Gap Card',
  'gapcard.review': 'reviewed a Gap Card',
  'analysis.run': 'ran the gap analysis',
};

export default function Audit() {
  const [blockedOnly, setBlockedOnly] = useState(false);
  const log = useApi(`/insights/audit${blockedOnly ? '?outcome=blocked' : ''}`);
  return (
    <>
      <PageHeader title="Audit log" intro="Every important action, in order. Entries can't be changed or deleted, by anyone." />
      <label className="mb-5 inline-flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={blockedOnly} onChange={(e) => setBlockedOnly(e.target.checked)} className="size-4" />
        Only blocked attempts to change a rating
      </label>
      {log.loading && <Loading />}
      {log.error && <LoadError error={log.error} retry={log.reload} />}
      {log.data && (log.data.length === 0 ? <Empty>Nothing here.</Empty> : (
        <Rows>
          {log.data.map((e) => (
            <Row key={e._id} className="flex flex-wrap items-baseline justify-between gap-2">
              <p>
                <strong>{e.actor?.name || e.actorLabel || 'Someone'}</strong>{' '}
                {e.outcome === 'blocked' ? `tried to change a locked ${e.entity === 'ClientRating' ? 'client rating' : e.entity === 'ManagerRating' ? 'manager rating' : e.entity}` : ACTION[e.action] || e.action}
                {e.detail && e.outcome !== 'blocked' && <span className="text-muted"> ({e.detail})</span>}
              </p>
              <span className="flex items-center gap-3 text-sm text-muted">
                {e.outcome === 'blocked' && <Badge tone="bad">Blocked</Badge>}
                {dateTime(e.createdAt)}
              </span>
            </Row>
          ))}
        </Rows>
      ))}
    </>
  );
}
