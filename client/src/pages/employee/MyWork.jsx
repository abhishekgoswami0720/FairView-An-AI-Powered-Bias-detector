import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { shortDate } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { Badge, Button, Empty, Input, LoadError, Loading, PageHeader, Row, Rows, Section } from '../../components/ui';

export default function MyWork() {
  const tasks = useApi('/tasks');
  if (tasks.loading && !tasks.data) return <Loading />;
  if (tasks.error) return <LoadError error={tasks.error} retry={tasks.reload} />;
  const by = (s) => tasks.data.filter((t) => t.status === s);
  const open = [...by('in_progress'), ...by('assigned')];
  const waiting = by('submitted');
  const delivered = by('delivered').slice(0, 8);

  return (
    <>
      <PageHeader title="My work" intro="Submit work here as you finish it. Nothing else is needed from you: your manager rates it, then the client does." />
      <Section title="To do" aside={`${open.length} open`}>
        {open.length === 0 ? <Empty>Nothing assigned to you right now.</Empty> : (
          <Rows>{open.map((t) => <OpenTask key={t._id} task={t} onChange={tasks.reload} />)}</Rows>
        )}
      </Section>
      <Section title="Waiting for your manager's review">
        {waiting.length === 0 ? <Empty>Nothing waiting.</Empty> : (
          <Rows>
            {waiting.map((t) => (
              <Row key={t._id} className="flex flex-wrap items-center justify-between gap-2">
                <TaskTitle task={t} />
                <Badge tone="mgr">{t.ratings.managerDone ? 'Rated, about to be delivered' : 'Submitted ' + shortDate(t.submittedAt)}</Badge>
              </Row>
            ))}
          </Rows>
        )}
      </Section>
      <Section title="Recently delivered" aside="Ratings are on My record">
        {delivered.length === 0 ? <Empty>Nothing delivered yet.</Empty> : (
          <Rows>
            {delivered.map((t) => (
              <Row key={t._id} className="flex flex-wrap items-center justify-between gap-2">
                <TaskTitle task={t} />
                <Badge tone={t.ratings.clientDone ? 'cli' : 'plain'}>{t.ratings.clientDone ? 'Client has rated' : 'Waiting for the client'}</Badge>
              </Row>
            ))}
          </Rows>
        )}
      </Section>
    </>
  );
}

function TaskTitle({ task }) {
  return (
    <div>
      <p className="font-semibold">{task.title}</p>
      <p className="text-sm text-muted">{task.project?.name}{task.project?.client?.company ? ` for ${task.project.client.company}` : ''}</p>
    </div>
  );
}

function OpenTask({ task, onChange }) {
  const toast = useToast();
  const [submission, setSubmission] = useState('');
  const [busy, setBusy] = useState(false);
  const move = async (status) => {
    setBusy(true);
    try {
      await api(`/tasks/${task._id}/status`, { method: 'PATCH', body: { status, submission: submission || undefined } });
      toast(status === 'submitted' ? 'Submitted. Your manager will review it.' : 'Started.');
      onChange();
    } catch (err) {
      toast(err.message, 'bad');
      setBusy(false);
    }
  };
  return (
    <Row>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TaskTitle task={task} />
        {task.status === 'assigned' && <Button size="sm" variant="quiet" busy={busy} onClick={() => move('in_progress')}>Start</Button>}
      </div>
      {task.description && <p className="mt-2 max-w-prose text-sm">{task.description}</p>}
      {task.status === 'in_progress' && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            move('submitted');
          }}
        >
          <label className="sr-only" htmlFor={`sub-${task._id}`}>Link or note about the work</label>
          <Input id={`sub-${task._id}`} required placeholder="Link to the pull request, demo or document" value={submission} onChange={(e) => setSubmission(e.target.value)} />
          <Button type="submit" busy={busy}>Submit</Button>
        </form>
      )}
    </Row>
  );
}
