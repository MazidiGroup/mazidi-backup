'use client';
import { useActionState } from 'react';
import { login } from './actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="lead">
      <div className="field">
        <label htmlFor="secret">Admin secret</label>
        <input id="secret" name="secret" type="password" required autoComplete="current-password" />
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Checking…' : 'Sign in'}</button>
      {state?.error && <p className="err mt-1">{state.error}</p>}
    </form>
  );
}
