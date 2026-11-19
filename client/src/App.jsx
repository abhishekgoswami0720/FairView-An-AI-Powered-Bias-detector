import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { homeFor, useAuth } from './lib/auth';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import { AcceptInvite, Login, Signup } from './pages/Auth';
import Rate from './pages/Rate';
import DevOutbox from './pages/DevOutbox';
import MyWork from './pages/employee/MyWork';
import MyRecord from './pages/employee/MyRecord';
import Review from './pages/manager/Review';
import Team from './pages/manager/Team';
import { ProjectDetail, Projects } from './pages/Projects';
import Overview from './pages/hr/Overview';
import People from './pages/hr/People';
import Audit from './pages/hr/Audit';

// The Gap Card pages carry the charting library, so they load only when HR opens them.
const GapCardList = lazy(() => import('./pages/hr/GapCards').then((m) => ({ default: m.GapCardList })));
const GapCardDetail = lazy(() => import('./pages/hr/GapCards').then((m) => ({ default: m.GapCardDetail })));

// Pages that need a login, optionally for certain roles only.
function Private({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

function Home() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <h1 className="text-3xl font-extrabold">This page doesn't exist</h1>
      <p className="mt-3 text-muted">The link may be wrong or out of date.</p>
      <Link to="/" className="mt-6 inline-block font-semibold text-mgr underline underline-offset-4">Go to FairView</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/rate/:token" element={<Rate />} />
      <Route path="/dev/outbox" element={<DevOutbox />} />

      <Route element={<Private><Layout /></Private>}>
        <Route path="/work" element={<Private roles={['employee']}><MyWork /></Private>} />
        <Route path="/record" element={<Private roles={['employee']}><MyRecord /></Private>} />
        <Route path="/review" element={<Private roles={['manager']}><Review /></Private>} />
        <Route path="/team" element={<Private roles={['manager']}><Team /></Private>} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/hr" element={<Private roles={['hr']}><Overview /></Private>} />
        <Route path="/hr/gap-cards" element={<Private roles={['hr']}><GapCardList /></Private>} />
        <Route path="/hr/gap-cards/:id" element={<Private roles={['hr']}><GapCardDetail /></Private>} />
        <Route path="/hr/people" element={<Private roles={['hr']}><People /></Private>} />
        <Route path="/hr/audit" element={<Private roles={['hr']}><Audit /></Private>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
