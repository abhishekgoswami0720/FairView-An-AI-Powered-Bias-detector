import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { homeFor, useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';
import { ROLE_LABEL } from '../lib/format';
import { Logo } from '../components/Layout';
import { Button, Field, Input, Loading, Notice } from '../components/ui';

function AuthFrame({ title, intro, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-10" />
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {intro && <p className="mt-2 text-muted">{intro}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 border-t border-rule pt-5 text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

function useSubmit(fn) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const { busy, error, run } = useSubmit(async () => {
    const result = await api('/auth/login', { method: 'POST', body: form });
    signIn(result);
    navigate(homeFor(result.user.role));
  });
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return (
    <AuthFrame
      title="Log in"
      intro="Every rating gets a second witness."
      footer={
        <>
          New company? <Link className="font-semibold text-mgr underline underline-offset-4" to="/signup">Set up FairView for your company</Link>
        </>
      }
    >
      <form onSubmit={run} className="flex flex-col gap-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Work email">{(id) => <Input id={id} type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}</Field>
        <Button type="submit" busy={busy} className="mt-2">Log in</Button>
      </form>
    </AuthFrame>
  );
}

export function Signup() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ orgName: '', name: '', email: '', password: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const { busy, error, run } = useSubmit(async () => {
    signIn(await api('/orgs', { method: 'POST', body: form }));
    navigate('/hr/people');
  });
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return (
    <AuthFrame
      title="Set up your company"
      intro="You'll be the HR admin. Next, you add your managers and employees, and they get an email to join."
      footer={<>Already using FairView? <Link className="font-semibold text-mgr underline underline-offset-4" to="/login">Log in</Link></>}
    >
      <form onSubmit={run} className="flex flex-col gap-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Company name">{(id) => <Input id={id} required value={form.orgName} onChange={set('orgName')} />}</Field>
        <Field label="Your name">{(id) => <Input id={id} required autoComplete="name" value={form.name} onChange={set('name')} />}</Field>
        <Field label="Work email">{(id) => <Input id={id} type="email" required autoComplete="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Password" hint="At least 8 characters.">{(id) => <Input id={id} type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />}</Field>
        <Button type="submit" busy={busy} className="mt-2">Create company</Button>
      </form>
    </AuthFrame>
  );
}

export function AcceptInvite() {
  const { token } = useParams();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const invite = useApi(`/public/invite/${token}`);
  const [password, setPassword] = useState('');
  const { busy, error, run } = useSubmit(async () => {
    const result = await api(`/public/invite/${token}`, { method: 'POST', body: { password } });
    signIn(result);
    navigate(homeFor(result.user.role));
  });
  if (invite.loading) return <AuthFrame title="Joining FairView"><Loading /></AuthFrame>;
  if (invite.error) return <AuthFrame title="This invite doesn't work"><Notice tone="bad">{invite.error.message}</Notice></AuthFrame>;
  const i = invite.data;
  return (
    <AuthFrame title={`Welcome, ${i.name.split(' ')[0]}`} intro={`You've been added to ${i.orgName} as ${ROLE_LABEL[i.role] === 'HR' ? 'an HR admin' : `a ${ROLE_LABEL[i.role].toLowerCase()}`}. Choose a password to finish.`}>
      <form onSubmit={run} className="flex flex-col gap-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Email">{(id) => <Input id={id} value={i.email} disabled />}</Field>
        <Field label="New password" hint="At least 8 characters.">{(id) => <Input id={id} type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <Button type="submit" busy={busy} className="mt-2">Join {i.orgName}</Button>
      </form>
    </AuthFrame>
  );
}
