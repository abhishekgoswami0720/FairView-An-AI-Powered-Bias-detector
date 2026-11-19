// The manager's main screen: rate submitted work (blind), then deliver it to the client.
import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { daysFromNow, shortDate } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { StarInput } from '../../components/Stars';
import { Pair } from '../../components/Pair';
import { Badge, Button, Empty, LoadError, Loading, PageHeader, Row, Rows, Section, Textarea } from '../../components/ui';

export default function Review() {
  const tasks = useApi('/tasks');
  if (tasks.loading && !tasks.data) return <Loading />;
  if (tasks.error) return <LoadError error={tasks.error} retry={tasks.reload} />;

  const submitted = tasks.data.filter((t) => t.status === 'submitted');
  const toRate = submitted.filter((t) => !t.ratings.managerDone);
  const toDeliver = submitted.filter((t) => t.ratings.managerDone);
  const withClient = tasks.data.filter((t) => t.status === 'delivered' && !t.ratings.clientDone);
  const recent = tasks.data.filter((t) => t.status === 'delivered' && t.ratings.clientDone).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Review work"
        intro="Rate each piece of work when it is submitted, then deliver it. The client rates it after you, so your rating is your own judgement and theirs is theirs."
      />
      <Section title="Rate" aside={`${toRate.length} waiting`}>
        {toRate.length === 0 ? <Empty>Nothing to rate. Submitted work appears here.</Empty> : (
          <Rows>{toRate.map((t) => <RateRow key={t._id} task={t} onDone={tasks.reload} />)}</Rows>
        )}
      </Section>

      {toDeliver.length > 0 && (
        <Section title="Rated, ready to deliver">
          <Rows>{toDeliver.map((t) => <DeliverRow key={t._id} task={t} onDone={tasks.reload} />)}</Rows>
        </Section>
      )}

      <Section title="With the client" aside="One reminder is sent automatically after 3 days">
        {withClient.length === 0 ? <Empty>No work is waiting for a client rating.</Empty> : (
          <Rows>{withClient.map((t) => <WaitingRow key={t._id} task={t} onDone={tasks.reload} />)}</Rows>
        )}
      </Section>

      {recent.length > 0 && (
        <Section title="Recently rated by clients">
          <Rows>
            {recent.map((t) => (
              <Row key={t._id} className="flex flex-wrap items-center justify-between gap-3">
                <Who task={t} />
                <Pair manager={t.ratings.manager?.score} client={t.ratings.client?.score} />
              </Row>
            ))}
          </Rows>
        </Section>
      )}
    </>
  );
}

function Who({ task }) {
  return (
    <div>
      <p className="font-semibold">{task.title}</p>
      <p className="text-sm text-muted">
        {task.employee?.name}, {task.project?.name}
      </p>
    </div>
  );
}

function RateRow({ task, onDone }) {
  const toast = useToast();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      toast(message);
      onDone();
    } catch (err) {
      toast(err.message, 'bad');
      setBusy(false);
    }
  };
  const rateAndDeliver = () =>
    act(async () => {
      await api(`/tasks/${task._id}/rating`, { method: 'POST', body: { score, comment: comment || undefined } });
      const res = await api(`/tasks/${task._id}/deliver`, { method: 'POST' });
      if (!res.emailSent) throw new Error('Rated and delivered, but the email to the client failed. Use "Resend link" below.');
    }, `Rated ${score} stars and sent to the client.`);
  const sendBack = () =>
    act(() => api(`/tasks/${task._id}/status`, { method: 'PATCH', body: { status: 'in_progress' } }), `Sent back to ${task.employee?.name}.`);

  return (
    <Row>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Who task={task} />
        <Badge>Submitted {shortDate(task.submittedAt)}</Badge>
      </div>
      {task.submission && (
        <p className="mt-2 break-words text-sm">
          {/^https?:\/\//.test(task.submission) ? <a href={task.submission} target="_blank" rel="noreferrer" className="text-mgr underline">{task.submission}</a> : task.submission}
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
        <StarInput value={score} onChange={setScore} size={34} label={`Your rating for ${task.title}`} />
        <Textarea aria-label="Comment (optional)" placeholder="Comment (optional). The employee sees it once the client has rated." maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="manager" busy={busy} disabled={!score} onClick={rateAndDeliver}>
          Rate and send to client
        </Button>
        <Button variant="quiet" busy={busy} onClick={sendBack}>Send back for rework</Button>
      </div>
      <p className="mt-2 text-sm text-muted">Your rating is locked once saved. Send work back first if it isn't finished.</p>
    </Row>
  );
}

function DeliverRow({ task, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const deliver = async () => {
    setBusy(true);
    try {
      await api(`/tasks/${task._id}/deliver`, { method: 'POST' });
      toast('Sent to the client.');
      onDone();
    } catch (err) {
      toast(err.message, 'bad');
      setBusy(false);
    }
  };
  return (
    <Row className="flex flex-wrap items-center justify-between gap-3">
      <Who task={task} />
      <div className="flex items-center gap-4">
        <Pair manager={task.ratings.manager?.score} />
        <Button size="sm" variant="manager" busy={busy} onClick={deliver}>Send to client</Button>
      </div>
    </Row>
  );
}

function WaitingRow({ task, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const resend = async () => {
    setBusy(true);
    try {
      await api(`/tasks/${task._id}/resend-link`, { method: 'POST' });
      toast('A new link was sent. The old one no longer works.');
      onDone();
    } catch (err) {
      toast(err.message, 'bad');
    }
    setBusy(false);
  };
  return (
    <Row className="flex flex-wrap items-center justify-between gap-3">
      <Who task={task} />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Sent {shortDate(task.deliveredAt)}, {daysFromNow(task.ratingWindowEndsAt)}</span>
        <Button size="sm" variant="quiet" busy={busy} onClick={resend}>Resend link</Button>
      </div>
    </Row>
  );
}
