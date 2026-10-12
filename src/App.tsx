import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { ConversationWorkspace } from './components/ConversationWorkspace';
import './App.css';

type Brand = { id: string; name: string };
function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandReady, setBrandReady] = useState(false);
  const [brandError, setBrandError] = useState('');
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setReady(true); }
    });
    supabase.auth.getSession().then(({ data, error: failure }) => {
      if (active) { setSession(data.session); setReady(true); if (failure) setError(failure.message); }
    }).catch(() => { if (active) { setError('Could not restore your session.'); setReady(true); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    let active = true;
    if (!session) return;
    Promise.resolve(supabase.from('brands').select('id, name')).then(({ data, error: failure }) => {
      if (active) { setBrands(data ?? []); setBrandError(failure?.message ?? ''); setBrandReady(true); }
    }).catch(() => { if (active) { setBrandError('Could not load your brand. Sign out and retry.'); setBrandReady(true); } });
    return () => { active = false; };
  }, [session]);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setBrands([]); setBrandReady(false); setBrandError('');
    try {
      const { error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (failure) setError(failure.message); else setPassword('');
    } catch { setError('Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try {
      const { error: failure } = await supabase.auth.signOut();
      if (failure) setError(failure.message);
      else { setBrands([]); setBrandReady(false); setBrandError(''); setPassword(''); }
    } catch { setError('Unable to sign out. Please try again.'); }
    finally { setBusy(false); }
  }
  if (ready && session) return <main>
    <header className="app-header workspace-header"><div className="brand-logo"><span className="logo-mark">✦</span> CX Assist</div><nav aria-label="Main navigation"><span className="active-nav">Conversations</span><button className="nav-button" disabled title="Knowledge base editor coming next">Knowledge Base</button></nav><div className="header-account"><span className="brand-label">{brands.length === 1 ? brands[0].name : 'Brand workspace'}</span><button className="secondary compact" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button></div></header>
    <div className="workspace-container">
      {error && <p className="error" role="alert">{error}</p>}
      {brandError ? <p className="error" role="alert">{brandError}</p> : brands.length > 1 ? <p className="error" role="alert">Unexpected access to multiple brands. Check memberships before continuing.</p> : brands.length === 1 ? <ConversationWorkspace key={session.user.id} brandName={brands[0].name} /> : <section className="panel"><p role="status">{brandReady ? 'No assigned brand. Check this account’s membership.' : 'Loading brand access…'}</p></section>}
    </div>
  </main>;
  return <main className="auth-page">
    <header className="app-header"><div className="brand-logo"><span className="logo-mark">✦</span> CX Assist</div><span>Agent workspace</span></header>
    <section className="auth-card" aria-busy={busy || !ready}>
      {!ready ? <p role="status">Restoring your session…</p> : <><span className="eyebrow">WELCOME BACK</span><h1>Sign in to CX Assist</h1><p className="muted">Use your assigned agent account to access your brand.</p><form onSubmit={signIn}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} /><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /><button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  </main>;
}
export default App;
