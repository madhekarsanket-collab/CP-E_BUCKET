import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { ApiError, errorMessage } from '../api';
import Field from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTitle } from '../hooks';

const PHONE_PATTERN = /^[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
const EMPTY = { name: '', email: '', password: '', phone: '', dob: '', address: '' };

// Mirrors the server's rules so people get instant feedback. The server stays the authority.
function validate(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = 'Enter your full name.';
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!PHONE_PATTERN.test(form.phone)) errors.phone = 'Enter a 10-digit mobile number starting with 6 to 9.';
  if (form.dob && form.dob > new Date().toISOString().slice(0, 10)) errors.dob = 'Date of birth must be in the past.';
  if (form.address.trim().length < 5) errors.address = 'Enter your delivery address.';
  return errors;
}

export default function Register() {
  useTitle('Create account');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  if (auth.isReady && auth.role) return <Navigate to="/" replace />;

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;
    setIsBusy(true);
    try {
      const { user } = await auth.signUp({ ...form, name: form.name.trim(), email: form.email.trim(), address: form.address.trim(), dob: form.dob || null });
      toast.success(`Welcome to E-Bucket, ${user.name.split(' ')[0]}.`);
      navigate('/', { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErrors({ email: e.message });
      else setFormError(errorMessage(e));
      setIsBusy(false);
    }
  };

  return (
    <div className="container page auth-wrap">
      <div className="card auth-card auth-card-wide">
        <h1>Create your account</h1>
        <form onSubmit={submit} noValidate>
          <Field label="Full name" value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" maxLength={100} />
          <div className="field-row">
            <Field label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" maxLength={100} />
            <Field label="Mobile number" type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel-national" maxLength={10} hint="10 digits, no country code" />
          </div>
          <div className="field-row">
            <Field label="Password" type="password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" maxLength={128} hint="At least 8 characters" />
            <Field label="Date of birth (optional)" type="date" value={form.dob} onChange={set('dob')} error={errors.dob} autoComplete="bday" />
          </div>
          <Field label="Delivery address" value={form.address} onChange={set('address')} error={errors.address} autoComplete="street-address" maxLength={255} hint="House, street, city and PIN code" />
          {formError && <p className="notice notice-error" role="alert">{formError}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isBusy}>{isBusy ? 'Creating your account' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
