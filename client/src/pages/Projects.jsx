// Projects, for managers (their own) and HR (all of them).
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';
import { STATUS_LABEL, shortDate } from '../lib/format';
import { useToast } from '../components/Toast';
import { Pair } from '../components/Pair';
import { Badge, Button, Dialog, Empty, Field, Input, LoadError, Loading, Notice, PageHeader, Row, Rows, Section, Select, Textarea } from '../components/ui';

export function Projects() {
  const { user } = useAuth();
  const projects = useApi('/projects');
  const [creating, setCreating] = useState(false);
  const canCreate = user.role === 'manager' || user.role === 'hr';

  return (
    <>
      <PageHeader
        title="Projects"
        intro="Each project has one client contact. Every piece of work delivered on it goes to that person for a 10-second rating."
        actions={canCreate && <Button onClick={() => setCreating(true)}>New project</Button>}
      />
      {projects.loading && <Loading />}
      {projects.error && <LoadError error={projects.error} retry={projects.reload} />}
      {projects.data && (projects.data.length === 0 ? <Empty>No projects yet.</Empty> : (
        <Rows>
          {projects.data.map((p) => {
            const c = p.taskCounts;
            const open = (c.assigned || 0) + (c.in_progress || 0) + (c.submitted || 0);
            return (
              <Row key={p._id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link to={`/projects/${p._id}`} className="font-semibold underline-offset-4 hover:underline">{p.name}</Link>
                  <p className="text-sm text-muted">
                    {p.client.company || p.client.name}
                    {user.role === 'hr' && `, run by ${p.manager?.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted">
                  <span>{open} open, {c.delivered || 0} delivered</span>
                  {p.status === 'closed' && <Badge>Closed</Badge>}
                </div>
              </Row>
            );
          })}
        </Rows>
      ))}
      {creating && <NewProject onClose={() => setCreating(false)} onCreated={projects.reload} />}
    </>
  );
}

function NewProject({ onClose, onCreated }) {
  const { user } = useAuth();
  const toast = useToast();
  const managers = useApi(user.role === 'hr' ? '/users?role=manager' : null);
  const [f, setF] = useState({ name: '', description: '', managerId: '', clientName: '', clientEmail: '', clientCompany: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/projects', {
        method: 'POST',
        body: {
          name: f.name, description: f.description || undefined,
          managerId: user.role === 'hr' ? f.managerId : undefined,
          client: { name: f.clientName, email: f.clientEmail, company: f.clientCompany || undefined },
        },
      });
      toast('Project created.');
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Dialog title="New project" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Project name">{(id) => <Input id={id} required value={f.name} onChange={set('name')} />}</Field>
        <Field label="Description" hint="Optional.">{(id) => <Textarea id={id} value={f.description} onChange={set('description')} />}</Field>
        {user.role === 'hr' && (
          <Field label="Manager">
            {(id) => (
              <Select id={id} required value={f.managerId} onChange={set('managerId')}>
                <option value="">Choose a manager</option>
                {managers.data?.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            )}
          </Field>
        )}
        <fieldset className="flex flex-col gap-4 rounded-control border border-rule p-4">
          <legend className="px-1 font-semibold">Client contact</legend>
          <p className="-mt-2 text-sm text-muted">The person at the client who accepts the work. They rate each delivered piece by email, without an account.</p>
          <Field label="Name">{(id) => <Input id={id} required value={f.clientName} onChange={set('clientName')} />}</Field>
          <Field label="Email">{(id) => <Input id={id} type="email" required value={f.clientEmail} onChange={set('clientEmail')} />}</Field>
          <Field label="Company" hint="Optional.">{(id) => <Input id={id} value={f.clientCompany} onChange={set('clientCompany')} />}</Field>
        </fieldset>
        <Button type="submit" busy={busy}>Create project</Button>
      </form>
    </Dialog>
  );
}

export function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const res = useApi(`/projects/${id}`);
  const [adding, setAdding] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  if (res.loading && !res.data) return <Loading />;
  if (res.error) return <LoadError error={res.error} retry={res.reload} />;
  const { project, tasks } = res.data;
  const isManager = user.role === 'manager' && String(project.manager?._id || project.manager) === String(user.id);

  const toggleStatus = async () => {
    try {
      await api(`/projects/${id}/status`, { method: 'PATCH', body: { status: project.status === 'active' ? 'closed' : 'active' } });
      toast(project.status === 'active' ? 'Project closed.' : 'Project reopened.');
      res.reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
  };

  return (
    <>
      <p className="mb-2"><Link to="/projects" className="text-sm font-semibold text-mgr underline underline-offset-4">All projects</Link></p>
      <PageHeader
        title={project.name}
        intro={project.description}
        actions={
          <>
            {isManager && project.status === 'active' && <Button onClick={() => setAdding(true)}>Add work</Button>}
            {(isManager || user.role === 'hr') && <Button variant="quiet" onClick={toggleStatus}>{project.status === 'active' ? 'Close project' : 'Reopen'}</Button>}
          </>
        }
      />
      <div className="mb-10 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-rule bg-surface px-5 py-4">
        <p>
          Client: <strong>{project.client.name}</strong>
          {project.client.company && `, ${project.client.company}`}
          {project.client.email && <span className="text-muted"> ({project.client.email})</span>}
          <span className="text-muted">. Manager: {project.manager?.name}.</span>
        </p>
        {user.role === 'hr' && <Button size="sm" variant="quiet" onClick={() => setEditingClient(true)}>Change client contact</Button>}
      </div>
      <Section title="Work" aside={`${tasks.length} pieces`}>
        {tasks.length === 0 ? <Empty>No work on this project yet.</Empty> : (
          <Rows>
            {tasks.map((t) => (
              <Row key={t._id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-sm text-muted">{t.employee?.name}, {STATUS_LABEL[t.status].toLowerCase()}{t.deliveredAt ? ` since ${shortDate(t.deliveredAt)}` : ''}</p>
                </div>
                {t.status === 'delivered' ? (
                  <Pair manager={t.ratings.manager?.score} client={t.ratings.client?.score} hidden={!t.ratings.manager && !t.ratings.client && !t.ratings.revealed} />
                ) : (
                  <Badge tone={t.status === 'submitted' ? 'mgr' : 'plain'}>{STATUS_LABEL[t.status]}</Badge>
                )}
              </Row>
            ))}
          </Rows>
        )}
      </Section>
      {adding && <AddWork project={project} onClose={() => setAdding(false)} onAdded={res.reload} />}
      {editingClient && <ChangeClient project={project} onClose={() => setEditingClient(false)} onSaved={res.reload} />}
    </>
  );
}

function AddWork({ project, onClose, onAdded }) {
  const toast = useToast();
  const employees = useApi('/users?role=employee');
  const [f, setF] = useState({ title: '', description: '', employeeId: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/tasks', { method: 'POST', body: { projectId: project._id, ...f, description: f.description || undefined } });
      toast('Work assigned.');
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Dialog title="Add work" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="What needs doing">{(id) => <Input id={id} required value={f.title} onChange={set('title')} placeholder="e.g. Payment retry flow" />}</Field>
        <Field label="Details" hint="Optional.">{(id) => <Textarea id={id} value={f.description} onChange={set('description')} />}</Field>
        <Field label="Who does it" hint="One owner per piece of work, like a ticket's assignee.">
          {(id) => (
            <Select id={id} required value={f.employeeId} onChange={set('employeeId')}>
              <option value="">Choose a person</option>
              {employees.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          )}
        </Field>
        <Button type="submit" busy={busy}>Assign</Button>
      </form>
    </Dialog>
  );
}

function ChangeClient({ project, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ name: project.client.name, email: project.client.email || '', company: project.client.company || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/projects/${project._id}/client`, { method: 'PATCH', body: { ...f, company: f.company || undefined } });
      toast('Client contact changed. The change is in the audit log.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Dialog title="Change client contact" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Notice tone="look">Only HR can do this, and every change is logged. Links already sent keep going to the old contact.</Notice>
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Name">{(id) => <Input id={id} required value={f.name} onChange={set('name')} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" required value={f.email} onChange={set('email')} />}</Field>
        <Field label="Company">{(id) => <Input id={id} value={f.company} onChange={set('company')} />}</Field>
        <Button type="submit" busy={busy}>Save contact</Button>
      </form>
    </Dialog>
  );
}
