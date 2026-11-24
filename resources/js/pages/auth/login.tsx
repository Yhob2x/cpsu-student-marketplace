import { FormEvent, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { LegacyButton } from '@/components/ui/legacy-button';
import { Field } from '@/components/ui/primitives';
import { api, explain, setToken } from '@/lib/api';
import { authFieldForError, type AuthField } from '@/lib/auth/auth-field-error';
import { safeLoginReturn } from '@/lib/auth/auth-return';
import { runExclusive } from '@/lib/auth/auth-submit';
import { useMe } from '@/providers/session-provider';

export function Login() {
  const nav = useNavigate(); const location = useLocation(); const { reload } = useMe(); const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const emailRef = useRef<HTMLInputElement>(null); const passwordRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const submitLock = useRef(false);
  const next = safeLoginReturn(new URLSearchParams(location.search).get('next'));
  const clearField = (field: AuthField) => setFieldErrors(previous => ({ ...previous, [field]: '' }));
  const go = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget));
    await runExclusive(submitLock, async () => {
      setBusy(true); setErr(''); setFieldErrors({});
      try {
        const r = await api('/auth/login', { body: d }); setToken(r.accessToken);
        const current = await reload();
        const staff = current?.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
        const reviewer = current?.roles.some(role => ['campus_reviewer', 'university_admin'].includes(role.role));
        nav(next === '/' && staff ? reviewer ? '/admin' : '/profile' : next, { replace: true });
      } catch (x) {
        const field = authFieldForError('login', x);
        if (field) {
          setFieldErrors({ [field]: explain(x) });
          requestAnimationFrame(() => (field === 'password' ? passwordRef : emailRef).current?.focus());
        } else setErr(explain(x));
      }
      finally { setBusy(false); }
    });
  };
  return <form className="stack auth-form" aria-busy={busy} onSubmit={go}><h1>Sign in</h1>
    <Field className="">Email
      <input ref={emailRef} name="email" type="email" placeholder="Your email address" autoComplete="email" required
        aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, email: 'Enter a valid email address.' }))}
        onChange={() => clearField('email')} />
    </Field>
    {fieldErrors.email && <p className="field-error" id="login-email-error" role="alert">{fieldErrors.email}</p>}
    <Field className="">Password
      <input ref={passwordRef} name="password" type="password" autoComplete="current-password" required
        aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, password: 'Enter your password.' }))}
        onChange={() => clearField('password')} />
    </Field>
    {fieldErrors.password && <p className="field-error" id="login-password-error" role="alert">{fieldErrors.password}</p>}
    {err && <p className="err" role="alert">{err}</p>}<LegacyButton className="" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</LegacyButton>
    <p className="muted">New here? <Link to={next === '/' ? '/register' : `/register?next=${encodeURIComponent(next)}`}>Create an account</Link></p></form>;
}
