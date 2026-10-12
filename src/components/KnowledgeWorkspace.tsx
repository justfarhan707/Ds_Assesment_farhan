import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createKnowledge, deleteKnowledge, loadKnowledge, updateKnowledge, type KnowledgeCategory, type KnowledgeEntry, type KnowledgeInput } from '../lib/knowledge';

const categories: KnowledgeCategory[] = ['products', 'returns', 'refunds', 'damage', 'shipping', 'cancellation'];
const labels: Record<KnowledgeCategory, string> = { products: 'Products & brand', returns: 'Returns', refunds: 'Refunds', damage: 'Damaged items', shipping: 'Shipping', cancellation: 'Cancellation' };
const blank: KnowledgeInput = { category: 'products', title: '', content: '' };
function errorText(cause: unknown) { return cause instanceof Error ? cause.message : typeof cause === 'object' && cause !== null && 'message' in cause ? String(cause.message) : 'Something went wrong. Please retry.'; }

export function KnowledgeWorkspace({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<KnowledgeCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [form, setForm] = useState<KnowledgeInput>(blank);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<KnowledgeEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    loadKnowledge().then(rows => { if (active) setEntries(rows); }).catch(cause => { if (active) setError(errorText(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => { if (editorOpen) titleRef.current?.focus(); }, [editorOpen]);
  useEffect(() => {
    if (!editorOpen && !deleting) return;
    const previous = document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button:not(:disabled), [role="dialog"] input:not(:disabled), [role="dialog"] select:not(:disabled), [role="dialog"] textarea:not(:disabled)'));
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', trap); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [editorOpen, deleting]);
  function open(entry: KnowledgeEntry | null) {
    setEditing(entry); setForm(entry ? { category: entry.category, title: entry.title, content: entry.content } : { ...blank }); setFormError(''); setNotice(''); setEditorOpen(true);
  }
  function close() {
    if (busy) return;
    if ((form.title !== (editing?.title ?? '') || form.content !== (editing?.content ?? '') || form.category !== (editing?.category ?? blank.category)) && !window.confirm('Discard your unsaved changes?')) return;
    setEditorOpen(false);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setFormError('');
    try {
      const saved = editing ? await updateKnowledge(editing.id, editing.version, form) : await createKnowledge(brandId, form);
      setEntries(previous => [...previous.filter(entry => entry.id !== saved.id), saved]);
      setEditorOpen(false); setNotice(editing ? 'Policy updated.' : 'Knowledge entry created.');
    } catch (cause) { setFormError(errorText(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function remove() {
    if (!deleting || lock.current) return;
    lock.current = true; setBusy(true); setFormError('');
    try { await deleteKnowledge(deleting.id, deleting.version); setEntries(previous => previous.filter(entry => entry.id !== deleting.id)); setDeleting(null); setNotice('Knowledge entry deleted.'); }
    catch (cause) { setFormError(errorText(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  const visible = entries.filter(entry => (filter === 'all' || entry.category === filter) && `${entry.title} ${entry.content}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title));
  return <>
    <div className="workspace-heading"><div><span className="eyebrow">BRAND KNOWLEDGE</span><h1>The source of every helpful answer.</h1><p className="muted">Manage policies and product information for {brandName}.</p></div><button onClick={() => open(null)}>+ Add entry</button></div>
    {notice && <p className="kb-notice" role="status">{notice}</p>}
    {error && <p className="error" role="alert">{error} <button className="secondary compact" onClick={() => { setError(''); setLoading(true); setReload(value => value + 1); }}>Retry</button></p>}
    <div className="kb-layout"><aside className="panel kb-sidebar"><span className="eyebrow">CATEGORIES</span><button className={filter === 'all' ? 'kb-filter active' : 'kb-filter'} onClick={() => setFilter('all')}>All entries <span>{entries.length}</span></button>{categories.map(category => <button key={category} className={filter === category ? 'kb-filter active' : 'kb-filter'} onClick={() => setFilter(category)}>{labels[category]}<span>{entries.filter(entry => entry.category === category).length}</span></button>)}<p className="kb-sidebar-note">Policies are kept separate for each brand. Edits automatically update the entry version.</p></aside>
    <section><div className="kb-toolbar"><label className="sr-only" htmlFor="kb-search">Search knowledge</label><input id="kb-search" type="search" placeholder="Search policies and products…" value={search} onChange={event => setSearch(event.target.value)} /><span className="muted small">{visible.length} entries</span></div>
    {loading ? <section className="panel" role="status">Loading knowledge…</section> : visible.length === 0 ? <section className="panel empty-state"><span className="empty-icon">▤</span><h3>{entries.length ? 'No matching entries' : 'Build your brand knowledge'}</h3><p>{entries.length ? 'Try another search or category.' : 'Add policies and product information to get started.'}</p></section> : <div className="kb-entry-grid">{visible.map(entry => <article className="panel kb-entry" key={entry.id}><div className="kb-entry-meta"><span className="badge">{labels[entry.category]}</span><span className="muted small">v{entry.version}</span></div><h2>{entry.title}</h2><p className="kb-content">{entry.content}</p><footer><span className="muted small">Updated {new Date(entry.updated_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}</span><div><button className="secondary compact" onClick={() => open(entry)}>Edit</button><button className="kb-delete compact" onClick={() => { setDeleting(entry); setFormError(''); }}>Delete</button></div></footer></article>)}</div>}
    </section></div>
    {editorOpen && <div className="modal-backdrop"><section className="panel kb-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title" onKeyDown={event => { if (event.key === 'Escape') close(); }}><div className="panel-heading"><h2 id="editor-title">{editing ? 'Edit knowledge entry' : 'Add knowledge entry'}</h2><button className="secondary compact" onClick={close} disabled={busy}>Cancel</button></div><p className="muted small">{brandName}{editing ? ` · Editing version ${editing.version}` : ''}</p><form onSubmit={save}><label htmlFor="entry-title">Title</label><input ref={titleRef} id="entry-title" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} required disabled={busy} /><label htmlFor="entry-category">Category</label><select id="entry-category" value={form.category} onChange={event => setForm({ ...form, category: event.target.value as KnowledgeCategory })} disabled={busy}>{categories.map(category => <option key={category} value={category}>{labels[category]}</option>)}</select><label htmlFor="entry-content">Policy or product information</label><textarea id="entry-content" rows={9} maxLength={20000} required value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} disabled={busy} /><span className="muted small">{form.content.length.toLocaleString()} / 20,000 characters</span>{formError && <p className="error" role="alert">{formError}</p>}<button type="submit" disabled={busy || !form.title.trim() || !form.content.trim()}>{busy ? 'Saving…' : 'Save entry'}</button></form></section></div>}
    {deleting && <div className="modal-backdrop"><section className="panel kb-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Delete this entry?</h2><p className="muted">“{deleting.title}” will be removed from {brandName}’s knowledge base. This cannot be undone.</p>{formError && <p className="error" role="alert">{formError}</p>}<div className="delete-actions"><button autoFocus className="secondary" onClick={() => setDeleting(null)} disabled={busy}>Keep entry</button><button className="danger-button" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete entry'}</button></div></section></div>}
  </>;
}
