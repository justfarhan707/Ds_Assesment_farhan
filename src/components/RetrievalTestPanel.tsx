import { useRef, useState, type FormEvent } from 'react';
import { retrieveKnowledge, type RetrievalResult } from '../lib/retrieveKnowledge';

export function RetrievalTestPanel() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const lock = useRef(false);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setResult(null);
    try { setResult(await retrieveKnowledge(query.trim())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Search failed. Please retry.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="panel retrieval-panel">
    <div className="panel-heading"><h2>Test policy retrieval</h2><span className="badge">Evidence only</span></div>
    <p className="muted small">Try a customer question to inspect this brand's search results. This does not send a message or generate a reply.</p>
    <form onSubmit={search} className="retrieval-form"><label className="sr-only" htmlFor="retrieval-query">Customer question</label><input id="retrieval-query" placeholder="For example: my order arrived damaged" value={query} onChange={event => setQuery(event.target.value)} maxLength={2000} required disabled={busy} /><button disabled={busy || !query.trim()}>{busy ? 'Searching...' : 'Find policies'}</button></form>
    {busy && <p role="status" className="muted small">Checking cache and retrieving brand policies...</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {result && <div aria-live="polite"><p className="muted small">Results for "{result.query}" - {result.retrievalMode === 'hybrid' ? 'Hybrid search' : 'Keyword search'} - {result.policies.length} candidates</p><p className="cache-diagnostics">Cache: <strong>{result.cacheStatus ?? 'Unavailable (redeploy backend)'}</strong> ? Embedding request: {result.embeddingCallMade === undefined ? 'unknown' : result.embeddingCallMade ? 'made' : 'avoided'} ? Retrieval: {result.retrievalLatencyMs ?? '?'} ms{result.cacheStored === false && result.cacheStatus === 'miss' ? ' ? Result not cached' : ''}</p>{result.warning && <p className="error">{result.warning}</p>}<p className="retrieval-caution">These are search candidates, not proof of eligibility. Scores express ranking and similarity, not answer confidence.</p>{result.policies.length === 0 ? <p>No matching policy candidates. The reply flow should request review when evidence is missing.</p> : <div className="retrieval-results">{result.policies.map(policy => <details key={policy.entry_id}><summary>{policy.title} <span className="muted small">v{policy.policy_version} - {policy.category}</span></summary><p>{policy.content}</p><small>Keyword match: {policy.keyword_match ? 'yes' : 'no'} | Semantic similarity: {policy.semantic_similarity === null ? 'unavailable' : policy.semantic_similarity.toFixed(3)} | Rank score: {policy.retrieval_score.toFixed(4)}</small></details>)}</div>}</div>}
  </section>;
}
