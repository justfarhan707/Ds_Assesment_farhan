import { supabase } from './supabase';
export type RetrievedPolicy = { entry_id: string; category: string; title: string; content: string; policy_version: number; retrieval_score: number; semantic_similarity: number | null; keyword_match: boolean };
export type RetrievalResult = { cacheHit: boolean; cacheStatus: 'hit' | 'miss' | 'unavailable'; cacheStored?: boolean; embeddingCallMade: boolean; retrievalLatencyMs: number; requestId: string; query: string; retrievalMode: 'hybrid' | 'keyword_only'; warning: string | null; policies: RetrievedPolicy[] };
export async function retrieveKnowledge(query: string): Promise<RetrievalResult> {
  const { data, error } = await supabase.functions.invoke('retrieve-knowledge', { body: { query } });
  if (error) {
    let message = error.message;
    if ('context' in error && error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      message = body?.error ?? message;
    }
    throw new Error(message);
  }
  if (!data || !Array.isArray(data.policies)) throw new Error('Unexpected retrieval response.');
  return data;
}
