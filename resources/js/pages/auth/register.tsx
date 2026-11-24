import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Field } from '@/components/ui/primitives';
import { api, explain, setToken } from '@/lib/api';
import { authFieldForError, type AuthField } from '@/lib/auth/auth-field-error';
import { safeLoginReturn } from '@/lib/auth/auth-return';
import { runExclusive } from '@/lib/auth/auth-submit';
import { useMe } from '@/providers/session-provider';

export function Register() {
  const nav = useNavigate(); const location = useLocation(); const { reload } = useMe();
  const next = safeLoginReturn(new URLSearchParams(location.search).get('next'));
  const [err, setErr] = useState(''); const [campuses, setCampuses] = useState<{ id: number; name: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const emailRef = useRef<HTMLInputElement>(null); const campusRef = useRef<HTMLSelectElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null); const idNumberRef = useRef<HTMLInputElement>(null);
  const [identityStatus, setIdentityStatus] = useState<'checking' | 'active' | 'inactive' | 'error'>('checking');
  const identityRequest = useRef(0);
  const [campusStatus, setCampusStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [campusError, setCampusError] = useState('');
  const campusRequest = useRef(0);
  const [busy, setBusy] = useState(false); const submitLock = useRef(false);
  const clearField = (field: AuthField) => setFieldErrors(previous => ({ ...previous, [field]: '' }));
  const loadCampuses = () => {
    const request = ++campusRequest.current;
    setCampusStatus('loading'); setCampusError('');
    api<{ id: number; name: string }[]>('/campuses').then(rows => {
      if (request !== campusRequest.current) return;
      setCampuses(rows);
      if (rows.length) setCampusStatus('ready');
      else { setCampusStatus('error'); setCampusError('No active campuses are available right now.'); }
    }).catch(x => {
      if (request !== campusRequest.current) return;
      setCampusStatus('error'); setCampusError(explain(x));
    });
  };
  useEffect(() => { loadCampuses(); return () => { campusRequest.current++; }; }, []);
  const loadIdentityPolicy = () => {
    const request = ++identityRequest.current;
    setIdentityStatus('checking');
    api<{ studentIdentityRequired: boolean }>('/auth/registration-policy')
      .then(policy => { if (identityRequest.current === request) setIdentityStatus(policy.studentIdentityRequired ? 'active' : 'inactive'); })
      .catch(() => { if (identityRequest.current === request) setIdentityStatus('error'); });
  };
  useEffect(() => { loadIdentityPolicy(); return () => { identityRequest.current++; }; }, []);
  const go = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (campusStatus !== 'ready' || (identityStatus !== 'active' && identityStatus !== 'inactive')) return;
    const d: any = Object.fromEntries(new FormData(e.currentTarget)); d.campusId = Number(d.campusId);
    await runExclusive(submitLock, async () => {
      setBusy(true); setErr(''); setFieldErrors({});
      try { const r = await api('/auth/register', { body: d }); setToken(r.accessToken); await reload(); nav(next === '/' ? '/dashboard' : next, { replace: true }); }
      catch (x) {
        const field = authFieldForError('register', x);
        if (field) {
          setFieldErrors({ [field]: explain(x) });
          requestAnimationFrame(() => {
            const target = field === 'campusId' ? campusRef : field === 'password' ? passwordRef
              : field === 'fullName' ? fullNameRef : field === 'studentIdNumber' ? idNumberRef : emailRef;
            target.current?.focus();
          });
        } else setErr(explain(x));
      }
      finally { setBusy(false); }
    });
  };
  return <form className="stack auth-form" aria-busy={busy} onSubmit={go}><h1>Create your account</h1>
    <Field className="">Display name
      <input name="displayName" placeholder="Name shown to others" required minLength={2} maxLength={80}
        aria-invalid={Boolean(fieldErrors.displayName)} aria-describedby={fieldErrors.displayName ? 'register-name-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, displayName: 'Enter a name with at least 2 characters.' }))}
        onChange={() => clearField('displayName')} />
    </Field>
    {fieldErrors.displayName && <p className="field-error" id="register-name-error" role="alert">{fieldErrors.displayName}</p>}
    <Field className="">Email
      <input ref={emailRef} name="email" type="email" autoComplete="email" required
        aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, email: 'Enter a valid email address.' }))}
        onChange={() => clearField('email')} />
    </Field>
    {fieldErrors.email && <p className="field-error" id="register-email-error" role="alert">{fieldErrors.email}</p>}
    <Field className="">Password (10 or more characters)
      <input ref={passwordRef} name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128}
        aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, password: 'Use 10 to 128 characters.' }))}
        onChange={() => clearField('password')} />
    </Field>
    {fieldErrors.password && <p className="field-error" id="register-password-error" role="alert">{fieldErrors.password}</p>}
    <Field className="">Campus
      <select ref={campusRef} name="campusId" required defaultValue="" disabled={campusStatus !== 'ready'}
        aria-invalid={Boolean(fieldErrors.campusId)} aria-describedby={fieldErrors.campusId ? 'register-campus-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, campusId: 'Choose your campus.' }))}
        onChange={() => clearField('campusId')}><option value="" disabled>Select a campus</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </Field>
    {fieldErrors.campusId && <p className="field-error" id="register-campus-error" role="alert">{fieldErrors.campusId}</p>}
    {campusStatus === 'loading' && <p className="muted" role="status">Loading campuses…</p>}
    {campusStatus === 'error' && <div className="stack" role="alert"><p className="err">Campus options could not load. {campusError}</p>
      <LegacyButton type="button" className="ghost" onClick={loadCampuses}>Retry campuses</LegacyButton></div>}
    {identityStatus === 'active' && <fieldset className="register-identity-fields" aria-describedby="register-private-identity-info">
      <legend>Private student verification details</legend>
      <p className="muted" id="register-private-identity-info">These details are kept private and do not automatically verify your CPSU affiliation.</p>
      <Field className="">Full name
        <input ref={fullNameRef} name="fullName" autoComplete="name" placeholder="Your full name for campus verification"
          required minLength={2} maxLength={120} aria-invalid={Boolean(fieldErrors.fullName)}
          aria-describedby={fieldErrors.fullName ? 'register-full-name-error register-private-identity-info' : 'register-private-identity-info'}
          onInvalid={() => setFieldErrors(previous => ({ ...previous, fullName: 'Enter your full name.' }))}
          onChange={() => clearField('fullName')} />
      </Field>
      {fieldErrors.fullName && <p className="field-error" id="register-full-name-error" role="alert">{fieldErrors.fullName}</p>}
      <Field className="">Student ID number
        <input ref={idNumberRef} name="studentIdNumber" type="text" inputMode="text" autoComplete="off"
          placeholder="Enter your CPSU student ID number" required minLength={3} maxLength={48}
          aria-invalid={Boolean(fieldErrors.studentIdNumber)}
          aria-describedby={fieldErrors.studentIdNumber ? 'register-student-id-error register-private-identity-info' : 'register-private-identity-info'}
          onInvalid={() => setFieldErrors(previous => ({ ...previous, studentIdNumber: 'Enter your student ID number as printed by CPSU.' }))}
          onChange={() => clearField('studentIdNumber')} />
      </Field>
      {fieldErrors.studentIdNumber && <p className="field-error" id="register-student-id-error" role="alert">{fieldErrors.studentIdNumber}</p>}
    </fieldset>}
    {identityStatus === 'error' && <div className="stack" role="alert"><p className="err">Could not check registration requirements.</p>
      <LegacyButton type="button" className="ghost" onClick={loadIdentityPolicy}>Retry registration check</LegacyButton></div>}
    <p className="muted">You can browse and message now. A campus reviewer must verify you before you can sell.</p>
    {err && <p className="err" role="alert">{err}</p>}
    <LegacyButton className="" disabled={busy || campusStatus !== 'ready' || (identityStatus !== 'active' && identityStatus !== 'inactive')}>{busy ? 'Creating account…' : 'Create account'}</LegacyButton>
    {identityStatus === 'inactive' && <p className="register-identity-note"><Icon name="shield" size={17} /><span><strong>Student ID and full name aren't collected yet.</strong> Identity collection is awaiting CPSU privacy approval. You can create an account without them.</span></p>}
    {identityStatus === 'checking' && <p className="muted" role="status">Checking private registration requirements…</p>}
  </form>;
}
