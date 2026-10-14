import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ConversationHistoryDrawer } from './ConversationHistoryDrawer';
import { AiReplyPanel } from './AiReplyPanel';
import { loadConversations, loadMessages, sendMessage, endConversationSession } from '../lib/conversations';

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
  const [ending, setEnding] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [followup, setFollowup] = useState<{ currentId: string; previousId: string; closedAt: string } | null>(null);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const endLock = useRef(false);
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
  }, [messages, mode]);
  async function endSession() {
    if (!conversation || endLock.current || sending || loading) return;
    if (!window.confirm('End this session and start an empty conversation? Previous messages and audit records will be preserved. Unsaved text will be discarded.')) return;
    endLock.current = true; setEnding(true); setError('');
    try {
      const nextId = await endConversationSession(conversation.id);
      setMessages([]); setText(''); setSendError(''); setSelectedId(nextId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not end the session.'); }
    finally { endLock.current = false; setEnding(false); }
  }
  const selectedFollowup = followup?.currentId === conversation?.id ? followup : null;
  const customer = conversation ? first(conversation.customers) : null;
  const order = conversation ? first(conversation.orders) : null;
  const latestCustomerId = [...messages].reverse().find(message => message.sender_role === 'customer')?.id;
  const date = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (mode === 'customer') return <section className="customer-chat-page">
    <div className="customer-view-banner"><div><span className="eyebrow">CUSTOMER PREVIEW</span><h1>Chat with {brandName}</h1><p>You are sending messages as {customer?.name ?? 'the customer'}.</p></div><button className="secondary" disabled={sending || ending} onClick={() => { setMode('agent'); setText(''); }}>Return to Agent workspace</button></div>
    {error && <p className="error" role="alert">{error}<button className="secondary compact" onClick={() => setAttempt(value => value + 1)}>Retry</button></p>}
    <div className="customer-chat-shell"><header className="customer-chat-header"><div className="customer-brand-avatar">{brandName.split(' ').map(part => part[0]).slice(0,2).join('')}</div><div><h2>{brandName}</h2><p>Customer support</p></div><div className="customer-chat-header-actions">{conversations.length > 1 && <select aria-label="Preview as customer" value={conversation?.id} disabled={sending || ending || loading} onChange={event => { setSelectedId(event.target.value); setText(''); }}>{conversations.map(row => <option key={row.id} value={row.id}>{first(row.customers)?.name ?? 'Customer'}</option>)}</select>}<button className="secondary compact" disabled={loading || sending || ending} onClick={() => setAttempt(value => value + 1)}>Refresh</button></div></header>
    {order && <details className="customer-order-summary"><summary><span>{order.order_number} ? {order.item_name}</span><span className="customer-order-status">{order.status}</span></summary><p>Quantity: {order.quantity} ? {new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.currency }).format(order.total_amount)}</p><p>Delivered: {order.delivered_at ? date(order.delivered_at) : 'Not delivered'}</p></details>}
    <div className="customer-chat-history" ref={historyRef} aria-live="polite" aria-busy={loading}>{loading ? <p className="empty-state" role="status">Loading your conversation...</p> : messages.length === 0 ? <div className="empty-state"><h3>How can we help?</h3><p>Send a message about your order or ask a product question.</p></div> : messages.map(message => <article key={message.id} className={`customer-chat-bubble ${message.sender_role === 'customer' ? 'from-you' : 'from-brand'}`}><span className="message-meta">{message.sender_role === 'customer' ? 'YOU' : brandName}</span><p>{message.content}</p><time dateTime={message.created_at}>{date(message.created_at)}</time></article>)}</div>
    <form className="customer-chat-composer" onSubmit={handleSend} aria-busy={sending}><label className="sr-only" htmlFor="customer-message">Message to customer support</label><textarea id="customer-message" value={text} onChange={event => setText(event.target.value)} placeholder={`Message ${brandName}...`} rows={2} maxLength={10000} disabled={loading || sending || ending || !conversation} /><button disabled={loading || sending || ending || !conversation || !text.trim()}>{sending ? 'Sending...' : 'Send message'}</button>{sendError && <p className="error send-error" role="alert">{sendError}</p>}</form>
    <footer className="customer-chat-footer"><p>Preview mode ? Replies appear after the agent sends them.</p><button className="customer-end-session" disabled={ending || sending || loading || !conversation} onClick={() => void endSession()}>{ending ? 'Ending session...' : 'End session'}</button></footer></div>
  </section>;

  return <>
    <div className="workspace-heading"><div><span className="eyebrow">SUPPORT WORKSPACE</span><h1>Every conversation, handled with care.</h1><p className="muted">{brandName} · Customer conversations</p></div><div className="session-controls">{ <button className="secondary" disabled={loading || !customer} onClick={() => setHistoryOpen(true)}>Previous conversations</button>}<div className="mode-switch" aria-label="Conversation side">{(['customer', 'agent'] as const).map(side => <button key={side} className={mode === side ? 'selected' : ''} disabled={sending || ending} aria-pressed={mode === side} onClick={() => setMode(side)}>{side === 'customer' ? 'Customer' : 'Agent'}</button>)}</div></div></div>
    { selectedFollowup && <div className="followup-banner"><div><strong>Previous session selected for AI context</strong><p>Closed {date(selectedFollowup.closedAt)}. Only this selected session will be included.</p></div><button className="secondary compact" onClick={() => { if (window.confirm('Remove historical context? Any visible draft will be cleared.')) setFollowup(null); }}>Remove previous context</button></div>}
    {error && <div className="error" role="alert">{error} <button className="secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
    <div className="workspace-grid">
      <aside className="customer-column">
        <section className="panel customer-panel"><span className="eyebrow">CUSTOMER</span><div className="avatar">{customer?.name.split(' ').map(part => part[0]).slice(0, 2).join('') || '—'}</div><h2>{customer?.name ?? (loading ? 'Loading…' : 'No customer')}</h2><p className="muted">{brandName}</p></section>
        <section className="panel"><span className="eyebrow">ORDER DETAILS</span>{order ? <><div className="order-status">{order.status}</div><dl><dt>Order number</dt><dd>{order.order_number}</dd><dt>Item</dt><dd>{order.item_name}</dd><dt>Quantity</dt><dd>{order.quantity}</dd><dt>Total</dt><dd>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.currency }).format(order.total_amount)}</dd><dt>Delivered</dt><dd>{order.delivered_at ? date(order.delivered_at) : 'Not delivered'}</dd></dl></> : <p className="muted">{loading ? 'Loading order…' : 'No order linked.'}</p>}</section>
        <div className="scope-note"><span aria-hidden="true">◇</span><p>You’re viewing your assigned brand’s workspace.</p></div>
      </aside>
      <section className="panel conversation-panel"><div className="panel-heading"><div><h2>Conversation</h2><p className="muted small">Agent view</p></div>{conversations.length > 1 && <select aria-label="Select conversation" value={conversation?.id} disabled={sending || ending || loading} onChange={event => { setSelectedId(event.target.value); setText(''); }}>{conversations.map(row => <option key={row.id} value={row.id}>{first(row.customers)?.name ?? 'Conversation'}</option>)}</select>}<button className="secondary compact" onClick={() => setAttempt(value => value + 1)} disabled={loading || sending || ending}>Refresh</button></div>
      <div ref={historyRef} className="message-history" aria-live="polite" aria-busy={loading}>{loading ? <div className="empty-state"><span className="empty-icon">↻</span><p>Loading conversation…</p></div> : messages.length === 0 ? <div className="empty-state"><span className="empty-icon">↗</span><h3>No messages yet</h3><p>The conversation will appear here.</p></div> : messages.map(message => <article key={message.id} className={`message ${message.sender_role === 'agent' ? 'agent-message' : 'customer-message'} ${message.id === latestCustomerId ? 'latest-message' : ''}`}><div className="message-meta">{message.id === latestCustomerId ? 'LATEST CUSTOMER MESSAGE' : message.sender_role === 'agent' ? 'AGENT' : customer?.name ?? 'CUSTOMER'}</div><p>{message.content}</p><time dateTime={message.created_at}>{date(message.created_at)}</time></article>)}</div>
      <form className="composer" onSubmit={handleSend} aria-busy={sending}><label className="sr-only" htmlFor="message">Message</label><textarea id="message" placeholder="Write a manual reply..." value={text} onChange={event => setText(event.target.value)} disabled={sending || ending || loading || !conversation} maxLength={10000} rows={2} /><button type="submit" disabled={sending || ending || loading || !conversation || !text.trim()}>{sending ? 'Sending?' : 'Send ?'}</button>{sendError && <p className="error send-error" role="alert">{sendError}</p>}<p className="composer-note">Sending as agent ? Messages are saved to this conversation.</p></form></section>
      <AiReplyPanel key={`${conversation?.id ?? 'empty'}:${selectedFollowup?.previousId ?? 'none'}`} previousConversationId={selectedFollowup?.previousId ?? null} conversationId={conversation?.id ?? ''} latestMessageId={messages[messages.length - 1]?.id} latestRole={messages[messages.length - 1]?.sender_role} disabled={loading || sending || ending || !conversation} onSent={message => setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous, message])} />
    </div>
    {historyOpen && conversation && customer && <ConversationHistoryDrawer key={`${conversation.brand_id}:${customer.id}`} brandId={conversation.brand_id} customerId={customer.id} customerName={customer.name} onClose={closeHistory} onUseContext={session => { if (window.confirm('Use this history for future AI drafts? Any visible draft will be cleared.')) { setFollowup({ currentId: conversation.id, previousId: session.id, closedAt: session.closed_at }); closeHistory(); } }} />}
  </>;
}
