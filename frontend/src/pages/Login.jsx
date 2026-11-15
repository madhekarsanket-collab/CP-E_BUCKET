import { ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { errorMessage } from '../api';
import Field from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTitle } from '../hooks';

// Shown only when the build sets VITE_DEMO_HINT=true (local demos), never in production builds.
const DEMO_HINT = import.meta.env.VITE_DEMO_HINT === 'true';

export default function Login() {
  useTitle('Sign in');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(params.get('admin') === '1');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  if (auth.isReady && auth.role) return <Navigate to={auth.isAdmin ? '/admin' : '/'} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setIsBusy(true);
    try {
      if (isAdmin) {
        await auth.signInAdmin(identity.trim(), password);
        navigate('/admin', { replace: true });
      } else {
        const { user } = await auth.signIn(identity.trim(), password);
        toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);
        navigate(location.state?.from || '/', { replace: true });
      }
    } catch (e) {
      setError(errorMessage(e));
      setIsBusy(false);
    }
  };

  const switchMode = (admin) => { setIsAdmin(admin); setIdentity(''); setPassword(''); setError(''); };

  return (
    <div className="container page auth-wrap">
      <div className="card auth-card">
        <h1>{isAdmin ? 'Admin sign in' : 'Welcome back'}</h1>
        <div className="segmented" role="group" aria-label="Account type">
          <button type="button" aria-pressed={!isAdmin} className={!isAdmin ? 'is-active' : ''} onClick={() => switchMode(false)}><UserRound size={16} aria-hidden="true" />Customer</button>
          <button type="button" aria-pressed={isAdmin} className={isAdmin ? 'is-active' : ''} onClick={() => switchMode(true)}><ShieldCheck size={16} aria-hidden="true" />Admin</button>
        </div>
        <form onSubmit={submit} noValidate>
          <Field label={isAdmin ? 'Username' : 'Email'} type={isAdmin ? 'text' : 'email'} value={identity} onChange={(e) => setIdentity(e.target.value)}
            autoComplete={isAdmin ? 'username' : 'email'} required maxLength={100} />
          <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required maxLength={128} />
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isBusy || !identity || !password}>{isBusy ? 'Signing in' : 'Sign in'}</button>
        </form>
        {DEMO_HINT && !isAdmin && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => { setIdentity('demo@ebucket.in'); setPassword('Demo@1234'); }}>Fill in the demo account</button>
        )}
        {!isAdmin && <p className="auth-switch">New here? <Link to="/register">Create an account</Link></p>}
      </div>
    </div>
  );
}
