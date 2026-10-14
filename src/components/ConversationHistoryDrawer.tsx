import { useEffect, useRef, useState } from 'react';
import { loadPreviousConversations, loadPreviousMessages, type PreviousConversation, type HistoryMessage } from '../lib/conversationHistory';

export function ConversationHistoryDrawer({ brandId, customerId, customerName, onClose, onUseContext }: { brandId: string; customerId: string; customerName: string; onClose: () => void; onUseContext: (session: PreviousConversation) => void }) {
  const [sessions, setSessions] = useState<PreviousConversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [retry, setRetry] = useState(0);
  const [messageRetry, setMessageRetry] = useState(0);
  const drawer = useRef<HTMLElement>(null);
  const date = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError('');
      try { const rows = await loadPreviousConversations({ brandId, customerId }); if (active) { setSessions(rows ?? []); setSelectedId(rows?.[0]?.id ?? ''); } }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load history.'); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [brandId, customerId, retry]);
  useEffect(() => {
    let active = true;
    async function load() {
      setMessages([]); setMessageError('');
      if (!selectedId) return;
      setMessageLoading(true);
      try { const rows = await loadPreviousMessages({ brandId, customerId }, selectedId); if (active) setMessages(rows); }
      catch (cause) { if (active) setMessageError(cause instanceof Error ? cause.message : 'Could not load messages.'); }
      finally { if (active) setMessageLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [brandId, customerId, selectedId, messageRetry]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = Array.from(drawer.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)') ?? []);
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [onClose]);
  const selected = sessions.find(session => session.id === selectedId);
  return <div className="history-backdrop"><section ref={drawer} className="history-drawer" role="dialog" aria-modal="true" aria-labelledby="history-title"><header className="panel-heading"><div><span className="eyebrow">PREVIOUS CONVERSATIONS</span><h2 id="history-title">{customerName}</h2></div><button className="secondary compact" onClick={onClose}>Close</button></header><p className="history-note">Read-only history. Opening a session does not add it to the current AI context.</p>
    {loading ? <p role="status">Loading closed sessions...</p> : error ? <div className="error" role="alert">{error}<button className="secondary compact" onClick={() => setRetry(value => value + 1)}>Retry</button></div> : sessions.length === 0 ? <div className="empty-state"><h3>No previous sessions</h3><p>Closed conversations for this customer will appear here.</p></div> : <><label htmlFor="history-session">Closed session</label><select id="history-session" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{sessions.map(session => <option key={session.id} value={session.id}>{date(session.closed_at)} - {session.id.slice(0, 8)}</option>)}</select>{selected && <p className="muted small">Started {date(selected.created_at)}<br />Closed {date(selected.closed_at)}</p>}<p className="muted small">Showing the latest {sessions.length} closed sessions (maximum 50).</p><button className="history-context-button" disabled={!selected || messageLoading || Boolean(messageError) || !messages.length} onClick={() => { if (selected) onUseContext(selected); }}>Use as follow-up context</button><div className="history-messages" aria-live="polite" aria-busy={messageLoading}>{messageLoading ? <p role="status">Loading messages...</p> : messageError ? <div className="error" role="alert">{messageError}<button className="secondary compact" onClick={() => setMessageRetry(value => value + 1)}>Retry</button></div> : messages.length === 0 ? <p className="muted">This session has no messages.</p> : messages.map(message => <article key={message.id} className={`message ${message.sender_role === 'agent' ? 'agent-message' : 'customer-message'}`}><div className="message-meta">{message.sender_role === 'agent' ? 'AGENT' : customerName}</div><p>{message.content}</p><time dateTime={message.created_at}>{date(message.created_at)}</time></article>)}</div></>}
  </section></div>;
}
