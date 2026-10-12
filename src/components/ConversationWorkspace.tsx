import { useEffect, useRef, useState, type FormEvent } from 'react';
import { loadConversations, loadMessages, sendMessage } from '../lib/conversations';

type Customer = { id: string; name: string };
type Order = { order_number: string; item_name: string; quantity: number; total_amount: number; currency: string; status: string; delivered_at: string | null };
type Conversation = { id: string; brand_id: string; auto_reply_enabled: boolean; customers: Customer | Customer[] | null; orders: Order | Order[] | null };
type Message = { id: string; sender_role: string; content: string; created_at: string };
function first<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }

export function ConversationWorkspace({ brandName }: { brandName: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'customer' | 'agent'>('agent');
  const [text, setText] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const sendLock = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError(''); setMessages([]);
      try {
        const rows = (await loadConversations() ?? []) as unknown as Conversation[];
        const selected = rows.find(row => row.id === selectedId) ?? rows[0];
        const history = selected ? await loadMessages(selected.id) : [];
        if (active) { setConversations(rows); setMessages(history ?? []); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your conversation.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [selectedId, attempt]);

  const conversation = conversations.find(row => row.id === selectedId) ?? conversations[0];
  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversation || loading || !text.trim() || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setSendError('');
    try {
      const saved = await sendMessage({ conversationId: conversation.id, brandId: conversation.brand_id, senderRole: mode, content: text });
      setMessages(previous => previous.some(message => message.id === saved.id) ? previous : [...previous, saved]);
      setText('');
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : 'Could not send your message. Your text has been preserved; check the conversation before retrying.');
    } finally { sendLock.current = false; setSending(false); }
  }
  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [messages]);
  const customer = conversation ? first(conversation.customers) : null;
  const order = conversation ? first(conversation.orders) : null;
  const latestCustomerId = [...messages].reverse().find(message => message.sender_role === 'customer')?.id;
  const date = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return <>
    <div className="workspace-heading"><div><span className="eyebrow">SUPPORT WORKSPACE</span><h1>Every conversation, handled with care.</h1><p className="muted">{brandName} · Customer conversations</p></div><div className="mode-switch" aria-label="Conversation side">{(['customer', 'agent'] as const).map(side => <button key={side} className={mode === side ? 'selected' : ''} disabled={sending} aria-pressed={mode === side} onClick={() => setMode(side)}>{side === 'customer' ? 'Customer' : 'Agent'}</button>)}</div></div>
    {error && <div className="error" role="alert">{error} <button className="secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
    <div className="workspace-grid">
      <aside className="customer-column">
        <section className="panel customer-panel"><span className="eyebrow">CUSTOMER</span><div className="avatar">{customer?.name.split(' ').map(part => part[0]).slice(0, 2).join('') || '—'}</div><h2>{customer?.name ?? (loading ? 'Loading…' : 'No customer')}</h2><p className="muted">{brandName}</p></section>
        <section className="panel"><span className="eyebrow">ORDER DETAILS</span>{order ? <><div className="order-status">{order.status}</div><dl><dt>Order number</dt><dd>{order.order_number}</dd><dt>Item</dt><dd>{order.item_name}</dd><dt>Quantity</dt><dd>{order.quantity}</dd><dt>Total</dt><dd>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.currency }).format(order.total_amount)}</dd><dt>Delivered</dt><dd>{order.delivered_at ? date(order.delivered_at) : 'Not delivered'}</dd></dl></> : <p className="muted">{loading ? 'Loading order…' : 'No order linked.'}</p>}</section>
        <div className="scope-note"><span aria-hidden="true">◇</span><p>You’re viewing your assigned brand’s workspace.</p></div>
      </aside>
      <section className="panel conversation-panel"><div className="panel-heading"><div><h2>Conversation</h2><p className="muted small">{mode === 'customer' ? 'Customer testing view' : 'Agent view'}</p></div>{conversations.length > 1 && <select aria-label="Select conversation" value={conversation?.id} disabled={sending || loading} onChange={event => { setSelectedId(event.target.value); setText(''); }}>{conversations.map(row => <option key={row.id} value={row.id}>{first(row.customers)?.name ?? 'Conversation'}</option>)}</select>}<button className="secondary compact" onClick={() => setAttempt(value => value + 1)} disabled={loading || sending}>Refresh</button></div>
      <div ref={historyRef} className="message-history" aria-live="polite" aria-busy={loading}>{loading ? <div className="empty-state"><span className="empty-icon">↻</span><p>Loading conversation…</p></div> : messages.length === 0 ? <div className="empty-state"><span className="empty-icon">↗</span><h3>No messages yet</h3><p>The conversation will appear here.</p></div> : messages.map(message => <article key={message.id} className={`message ${message.sender_role === 'agent' ? 'agent-message' : 'customer-message'} ${message.id === latestCustomerId ? 'latest-message' : ''}`}><div className="message-meta">{message.id === latestCustomerId ? 'LATEST CUSTOMER MESSAGE' : message.sender_role === 'agent' ? 'AGENT' : customer?.name ?? 'CUSTOMER'}</div><p>{message.content}</p><time dateTime={message.created_at}>{date(message.created_at)}</time></article>)}</div>
      <form className="composer" onSubmit={handleSend} aria-busy={sending}><label className="sr-only" htmlFor="message">Message</label><textarea id="message" placeholder={mode === 'customer' ? 'Write as the customer?' : 'Write a manual reply?'} value={text} onChange={event => setText(event.target.value)} disabled={sending || loading || !conversation} maxLength={10000} rows={2} /><button type="submit" disabled={sending || loading || !conversation || !text.trim()}>{sending ? 'Sending?' : 'Send ?'}</button>{sendError && <p className="error send-error" role="alert">{sendError}</p>}<p className="composer-note">Sending as {mode === 'customer' ? 'customer (testing mode)' : 'agent'} ? Messages are saved to this conversation.</p></form></section>
      {mode === 'agent' ? <aside className="panel ai-panel"><div className="panel-heading"><h2><span className="sparkle">✦</span> AI reply</h2><span className="badge neutral">Not connected</span></div><div className="automation-row"><div><strong>Auto-reply</strong><p className="muted small">Send supported replies automatically</p></div><button className="toggle-off" disabled aria-label="Auto-reply unavailable" title="Automation backend pending"><span /></button></div><button className="generate-button" disabled>✦ Generate reply</button><div className="draft-empty"><span className="empty-icon">✦</span><h3>A thoughtful reply starts here</h3><p>Generate a draft from this brand’s policies, then review and edit it before sending.</p></div><div className="draft-actions"><button className="secondary" disabled>Regenerate</button><button className="approve" disabled>Approve & send</button></div><div className="evidence-section"><span className="eyebrow">POLICY EVIDENCE</span><div className="evidence-empty"><span>▤</span><p>Retrieved policy excerpts and eligibility checks will appear here with each draft.</p></div></div><p className="ai-footnote">AI generation and policy retrieval are not connected yet.</p></aside> : <aside className="panel customer-help"><span className="eyebrow">CUSTOMER VIEW</span><h2>Test the conversation</h2><p className="muted">Write a customer message, then switch to Agent to review and respond.</p><p className="muted">Internal AI drafts and policy evidence are shown in Agent view.</p></aside>}
    </div>
  </>;
}
