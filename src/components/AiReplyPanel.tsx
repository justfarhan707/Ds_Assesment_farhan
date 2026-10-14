import { useEffect, useRef, useState } from 'react';
import { generateReply, approveReply, type SentReply, type ReplyGeneration } from '../lib/replies';

export function AiReplyPanel({ conversationId, latestMessageId, latestRole, disabled, onSent, previousConversationId }: { conversationId: string; previousConversationId: string | null; latestMessageId?: string; latestRole?: string; disabled: boolean; onSent: (message: SentReply) => void }) {
  const [generation, setGeneration] = useState<ReplyGeneration | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [sent, setSent] = useState(false);
  const key = useRef<string | null>(null);
  const requestMessage = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const stale = Boolean(generation && generation.customer_message_id !== latestMessageId);
  const canGenerate = !disabled && latestRole === 'customer' && Boolean(latestMessageId);
  async function generate(fresh: boolean) {
    if (lock.current || !canGenerate) return;
    if (fresh && generation && draft !== generation.ai_response && !window.confirm('Replace your edited draft with a new generation?')) return;
    if (fresh || !key.current || requestMessage.current !== latestMessageId) key.current = crypto.randomUUID();
    requestMessage.current = latestMessageId;
    lock.current = true; setBusy(true); setError(''); setPending(false);
    try {
      const result = await generateReply(conversationId, key.current!, previousConversationId);
      if (!alive.current) return;
      if (result.status === 'pending') { setPending(true); return; }
      if (result.status !== 'draft' || !result.ai_response) {
        key.current = null;
        throw new Error(result.status === 'failed' ? `Generation failed at ${result.error_code ?? 'unknown stage'}. Start a new generation.` : 'This request no longer has an available draft.');
      }
      setGeneration(result); setDraft(result.ai_response); setSent(false); setApprovalError('');
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Generation failed.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function approve() {
    if (!generation || lock.current || !draft.trim() || stale || disabled || sent) return;
    if ((generation.answerability !== 'supported' || generation.review_reasons.length > 0) && !window.confirm('This draft needs review. Have you reviewed its evidence and wording before sending?')) return;
    lock.current = true; setApproving(true); setApprovalError('');
    try {
      const message = await approveReply(generation.id, draft);
      if (!alive.current) return;
      setSent(true); setGeneration({ ...generation, status: 'sent' }); onSent(message);
    } catch (cause) { if (alive.current) setApprovalError(cause instanceof Error ? cause.message : 'Approval failed. Retry approval to check the existing send result.'); }
    finally { lock.current = false; if (alive.current) setApproving(false); }
  }
  return <aside className="panel ai-panel" aria-busy={busy || approving}>
    <div className="panel-heading"><h2><span className="sparkle">✦</span> AI reply</h2><span className="badge">{generation ? generation.answerability === 'supported' ? 'Evidence selected' : 'Needs review' : 'Ready'}</span></div>
    {previousConversationId && <p className="ai-footnote">Follow-up context: selected closed session {previousConversationId.slice(0, 8)}.</p>}
    <button className="generate-button" disabled={busy || approving || !canGenerate} onClick={() => void generate(true)}>{busy ? 'Generating reply...' : 'Generate reply'}</button>
    {!canGenerate && !disabled && <p className="ai-footnote">Send a customer message to begin.</p>}
    {busy && <p className="muted small" role="status">Retrieving policies and drafting your reply. This may take a moment.</p>}
    {error && <div className="error" role="alert">{error}<button className="secondary compact" disabled={busy || approving || !canGenerate} onClick={() => void generate(false)}>Retry same request</button></div>}
    {pending && <div className="evidence-empty" role="status">Your request is still pending. Check its result without starting another model call.<button className="secondary compact" onClick={() => void generate(false)} disabled={busy || approving || !canGenerate}>Check result</button></div>}
    {generation ? <><label className="draft-label" htmlFor="ai-draft">Suggested reply {draft !== generation.ai_response && <span className="muted small">(edited)</span>}</label><textarea id="ai-draft" className="ai-draft" rows={9} maxLength={10000} value={draft} onChange={event => setDraft(event.target.value)} disabled={busy || approving || sent} />{stale && !sent && <p className="error" role="alert">The conversation has changed. Generate a fresh draft before approval.</p>}<div className="draft-actions"><button className="secondary" disabled={busy || approving || !canGenerate} onClick={() => void generate(true)}>Regenerate</button><button className="approve" disabled={busy || approving || disabled || stale || sent || !draft.trim()} onClick={() => void approve()}>{approving ? 'Sending...' : sent ? 'Sent' : 'Approve & send'}</button></div>
    {approvalError && <p className="error" role="alert">{approvalError}</p>}
    {sent && <p className="kb-notice" role="status">Reply sent and audit record saved.</p>}
    {generation.review_reasons.length > 0 && <div className="reply-review"><strong>Review needed</strong><ul>{generation.review_reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div>}
    {generation.missing_information.length > 0 && <div className="reply-review"><strong>Missing information</strong><ul>{generation.missing_information.map((fact, index) => <li key={index}>{fact}</li>)}</ul></div>}
    <div className="evidence-section"><span className="eyebrow">SELECTED POLICY EVIDENCE</span>{generation.selected_evidence.length ? generation.selected_evidence.map((evidence, index) => { const policy = generation.retrieved_context.find(item => item.entry_id === evidence.policy_id); return <details className="reply-evidence" key={index} open><summary>{policy?.title ?? 'Policy'} · v{policy?.policy_version}</summary><blockquote>{evidence.quote}</blockquote></details>; }) : <p className="muted small">No supporting evidence selected. Review the fallback draft.</p>}
    {generation.previous_conversation_id && <details className="reply-evidence"><summary>Historical messages used ({generation.previous_conversation_snapshot?.length ?? 0})</summary>{generation.previous_conversation_snapshot?.map(message => <div key={message.id}><strong>{message.sender_role}</strong><p>{message.content}</p></div>)}</details>}
    <details className="reply-evidence"><summary>All retrieved candidates ({generation.retrieved_context.length})</summary>{generation.retrieved_context.map(policy => <div key={policy.entry_id}><strong>{policy.title} · v{policy.policy_version}</strong><p>{policy.content}</p></div>)}</details></div><p className="ai-footnote">{generation.model} · {generation.latency_ms !== null ? `${(generation.latency_ms / 1000).toFixed(1)}s` : 'Timing unavailable'} · Original draft and evidence saved. {sent ? 'Final edits saved on approval.' : 'Edits are saved when you approve and send.'}</p></> : <div className="draft-empty"><span className="empty-icon">✦</span><h3>A thoughtful reply starts here</h3><p>Generate a draft, inspect its policy evidence, and edit its wording.</p></div>}
    <p className="ai-footnote">Approval saves your final wording and posts it to this conversation. Evidence selection is not a guarantee of policy compliance.</p>
  </aside>;
}
