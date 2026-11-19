import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { ROLE_LABEL } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { Badge, Button, Dialog, Empty, Field, Input, LoadError, Loading, Notice, PageHeader, Select } from '../../components/ui';

export default function People() {
  const { user } = useAuth();
  const people = useApi('/users');
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  const act = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      people.reload();
    } catch (err) {
      toast(err.message, 'bad');
    }
  };

  return (
    <>
      <PageHeader
        title="People"
        intro="Add managers and employees here. Each person gets an email to choose their own password. People who leave are deactivated, never deleted, so their ratings stay on record."
        actions={
          <>
            <Button variant="quiet" onClick={() => setImporting(true)}>Import CSV</Button>
            <Button onClick={() => setAdding(true)}>Add person</Button>
          </>
        }
      />
      {people.loading && !people.data && <Loading />}
      {people.error && <LoadError error={people.error} retry={people.reload} />}
      {people.data && (people.data.length === 0 ? <Empty>No one here yet.</Empty> : (
        <div className="overflow-x-auto rounded-panel border border-rule bg-surface">
          <table className="w-full min-w-[40rem] text-left">
            <thead className="border-b border-rule text-sm text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                <th scope="col" className="px-3 py-3 font-semibold">Role</th>
                <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {people.data.map((p) => {
                const me = p.id === user.id;
                return (
                  <tr key={p.id} className={p.active ? '' : 'text-muted'}>
                    <td className="px-5 py-3">
                      <p className="font-semibold">{p.name}{me && ' (you)'}</p>
                      <p className="text-sm text-muted">{p.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <label className="sr-only" htmlFor={`role-${p.id}`}>Role of {p.name}</label>
                      <select
                        id={`role-${p.id}`}
                        disabled={me || !p.active}
                        value={p.role}
                        onChange={(e) => act(() => api(`/users/${p.id}`, { method: 'PATCH', body: { role: e.target.value } }), `${p.name} is now ${ROLE_LABEL[e.target.value]}.`)}
                        className="rounded border border-rule bg-surface px-2 py-1"
                      >
                        {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      {!p.active ? <Badge>Deactivated</Badge> : p.joined ? <Badge tone="cli">Active</Badge> : <Badge tone="look">Invite sent</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        {p.active && !p.joined && (
                          <Button variant="link" onClick={() => act(() => api(`/users/${p.id}/resend-invite`, { method: 'POST' }), `New invite sent to ${p.email}.`)}>Resend invite</Button>
                        )}
                        {!me && (
                          <Button
                            variant="link"
                            onClick={() => act(() => api(`/users/${p.id}`, { method: 'PATCH', body: { active: !p.active } }), p.active ? `${p.name} deactivated.` : `${p.name} reactivated.`)}
                          >
                            {p.active ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      {adding && <AddPerson onClose={() => setAdding(false)} onAdded={people.reload} />}
      {importing && <ImportCsv onClose={() => setImporting(false)} onDone={people.reload} />}
    </>
  );
}

function AddPerson({ onClose, onAdded }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', role: 'employee' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/users', { method: 'POST', body: f });
      toast(r.emailSent ? `Invite sent to ${f.email}.` : `Added, but the invite email failed. Use "Resend invite".`, r.emailSent ? 'good' : 'bad');
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Dialog title="Add a person" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Name">{(id) => <Input id={id} required value={f.name} onChange={set('name')} />}</Field>
        <Field label="Work email">{(id) => <Input id={id} type="email" required value={f.email} onChange={set('email')} />}</Field>
        <Field label="Role">
          {(id) => (
            <Select id={id} value={f.role} onChange={set('role')}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hr">HR</option>
            </Select>
          )}
        </Field>
        <Button type="submit" busy={busy}>Send invite</Button>
      </form>
    </Dialog>
  );
}

function ImportCsv({ onClose, onDone }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const text = await file.text();
      setResult(await api('/users/import', { method: 'POST', body: text, raw: true, headers: { 'Content-Type': 'text/csv' } }));
      onDone();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return (
    <Dialog title="Import people from a CSV file" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p>The first row must be the headers <code className="rounded bg-paper px-1">name,email,role</code>. Role is employee, manager or hr. Everyone in the file gets an invite email.</p>
        <pre className="rounded bg-paper p-3 text-sm">name,email,role{'\n'}Priya Sharma,priya@yourcompany.com,employee{'\n'}Rahul Verma,rahul@yourcompany.com,manager</pre>
        <label className="font-semibold" htmlFor="csv">Choose a file</label>
        <input id="csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => upload(e.target.files[0])} />
        {busy && <p className="text-muted">Importing…</p>}
        {error && <Notice tone="bad">{error}</Notice>}
        {result && (
          <Notice tone={result.errors.length ? 'look' : 'good'}>
            <p className="font-semibold">{result.created.length} added and invited.</p>
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {result.errors.map((e) => <li key={e.line}>Line {e.line}: {e.error}</li>)}
              </ul>
            )}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}
