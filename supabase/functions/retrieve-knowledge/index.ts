
//app.post('/retrieve-knowledge', async (req, res) => {
// 1. Authenticate the agent.
// 2. Validate the question.
// 3. Embed it using RETRIEVAL_QUERY and 768 dimensions.
// 4. Call search_knowledge using the agent's token.
// 5. Return policy text, versions, and retrieval scores.
//});

import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'gemini-embedding-001';
const CACHE_CONFIG = `${MODEL}:768:rrf60:top6:normalize-v1`;
type CachedCandidate = { entry_id: string; policy_version: number; retrieval_score: number; semantic_similarity: number | null; keyword_match: boolean };
async function hashQuery(query: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(query));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const started = Date.now();
  let embeddingCallMade = false;
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return respond(405, { error: 'Use POST.' });
  }

  const authorization = req.headers.get('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return respond(401, { error: 'Sign in first.' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!url || !anonKey) {
    return respond(500, { error: 'Backend configuration incomplete.' });
  }

  // All database calls use the agent's identity and RLS.
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestId = crypto.randomUUID();
  let stage = 'authentication';

  try {
    const { data: auth, error: authError } =
      await client.auth.getUser();

    if (authError || !auth.user) {
      return respond(401, { error: 'Session expired. Sign in again.' });
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return respond(400, { error: 'Invalid JSON body.' });
    }

    const rawQuery =
      typeof body === 'object' &&
        body !== null &&
        'query' in body
        ? body.query
        : null;

    if (typeof rawQuery !== 'string') {
      return respond(400, { error: 'A query is required.' });
    }

    const query = rawQuery.normalize('NFC').trim().replace(/\s+/g, ' ');

    if (!query || query.length > 2000) {
      return respond(400, {
        error: 'Query must contain 1–2,000 characters.',
      });
    }

    stage = 'membership';

    const { data: membership, error: membershipError } = await client
      .from('brand_memberships')
      .select('brand_id')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (membershipError) throw new Error('Membership lookup failed.');

    if (!membership) {
      return respond(403, { error: 'No brand assigned to this account.' });
    }

    const queryHash = await hashQuery(query);
    let cacheAvailable = false;
    let knowledgeRevision: number | null = null;
    let indexRevision: number | null = null;
    try {
      const { data: brand, error: brandError } = await client.from('brands')
        .select('knowledge_revision, index_revision').eq('id', membership.brand_id).single();
      if (brandError || !brand) throw new Error('Cache revisions unavailable.');
      knowledgeRevision = brand.knowledge_revision;
      indexRevision = brand.index_revision;
      cacheAvailable = true;
      const { data: cached, error: cacheError } = await client.rpc('get_retrieval_cache', {
        p_query_hash: queryHash, p_config_version: CACHE_CONFIG,
      });
      if (cacheError) throw cacheError;
      if (cached) {
        if (!Array.isArray(cached.candidates) || cached.candidates.length > 6) throw new Error('Invalid cached candidates.');
        const candidates: CachedCandidate[] = cached.candidates;
        if (!candidates.every(candidate => candidate && typeof candidate.entry_id === 'string' && Number.isInteger(candidate.policy_version))) throw new Error('Invalid cache shape.');
        let rows: { id: string; category: string; title: string; content: string; version: number }[] = [];
        if (candidates.length) {
          const { data, error } = await client.from('knowledge_entries')
            .select('id, category, title, content, version')
            .eq('brand_id', membership.brand_id).in('id', candidates.map(candidate => candidate.entry_id));
          if (error) throw error;
          rows = data ?? [];
        }
        const byId = new Map(rows.map(row => [row.id, row]));
        const allCurrent = candidates.every(candidate => byId.get(candidate.entry_id)?.version === candidate.policy_version);
        const { data: current, error: revisionError } = await client.from('brands')
          .select('knowledge_revision, index_revision').eq('id', membership.brand_id).single();
        if (revisionError || !current) throw new Error('Revision recheck failed.');
        if (allCurrent && current.knowledge_revision === cached.knowledge_revision && current.index_revision === cached.index_revision) {
          const policies = candidates.map(candidate => {
            const row = byId.get(candidate.entry_id)!;
            return { ...candidate, category: row.category, title: row.title, content: row.content };
          });
          const diagnostics = { cacheHit: true, cacheStatus: 'hit', embeddingCallMade: false, retrievalLatencyMs: Date.now() - started };
          console.info('Retrieval completed', { requestId, ...diagnostics });
          return respond(200, { requestId, query, retrievalMode: 'hybrid', warning: null, policies, ...diagnostics });
        }
      }
    } catch {
      cacheAvailable = false;
      console.warn('Cache unavailable; using normal retrieval', { requestId });
    }

    let queryEmbedding: string | null = null;
    let retrievalMode: 'hybrid' | 'keyword_only' = 'keyword_only';
    let warning: string | null = null;

    stage = 'query_embedding';

    try {
      if (!geminiKey) {
        throw new Error('Embedding provider not configured.');
      }

      embeddingCallMade = true;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiKey,
          },
          body: JSON.stringify({
            model: `models/${MODEL}`,
            content: {
              parts: [{ text: query }],
            },
            taskType: 'RETRIEVAL_QUERY',
            outputDimensionality: 768,
          }),
          signal: AbortSignal.timeout(25000),
        },
      );

      if (!response.ok) {
        console.error('Query embedding provider failed', {
          requestId,
          status: response.status,
        });

        throw new Error('Embedding request failed.');
      }

      const result = await response.json();
      const values: unknown = result.embedding?.values;

      if (
        !Array.isArray(values) ||
        values.length !== 768 ||
        !values.every(value =>
          typeof value === 'number' && Number.isFinite(value)
        )
      ) {
        throw new Error('Invalid query embedding.');
      }

      const norm = Math.hypot(...values);

      if (!Number.isFinite(norm) || norm === 0) {
        throw new Error('Invalid embedding magnitude.');
      }

      queryEmbedding = JSON.stringify(
        values.map(value => value / norm),
      );

      retrievalMode = 'hybrid';
    } catch {
      // Retrieval can continue against current policy text.
      warning = 'Semantic search unavailable; using keyword search.';
      console.warn('Keyword fallback activated', { requestId });
    }

    stage = 'policy_search';

    const { data: policies, error: searchError } = await client.rpc(
      'search_knowledge',
      {
        p_query: query,
        p_query_embedding: queryEmbedding,
        p_embedding_model: MODEL,
        p_limit: 6,
      },
    );

    if (searchError) {
      console.error('Knowledge search failed', {
        requestId,
        code: searchError.code,
        message: searchError.message,
      });

      throw new Error('Policy search failed.');
    }

    let cacheStored = false;
    if (cacheAvailable && retrievalMode === 'hybrid' && knowledgeRevision !== null && indexRevision !== null) {
      try {
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!serviceKey) throw new Error('Cache write key unavailable.');
        const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const candidates = (policies ?? []).map((policy: CachedCandidate) => ({
          entry_id: policy.entry_id, policy_version: policy.policy_version,
          retrieval_score: policy.retrieval_score, semantic_similarity: policy.semantic_similarity,
          keyword_match: policy.keyword_match,
        }));
        const { data: saved, error: writeError } = await admin.rpc('put_retrieval_cache', {
          p_brand_id: membership.brand_id, p_query_hash: queryHash,
          p_knowledge_revision: knowledgeRevision, p_index_revision: indexRevision,
          p_config_version: CACHE_CONFIG, p_candidates: candidates,
        });
        if (writeError) throw writeError;
        cacheStored = saved === true;
      } catch { console.warn('Cache write failed; returning normal results', { requestId }); }
    }
    const diagnostics = {
      cacheHit: false, cacheStatus: cacheAvailable ? 'miss' : 'unavailable', cacheStored,
      embeddingCallMade, retrievalLatencyMs: Date.now() - started,
    };
    console.info('Retrieval completed', { requestId, ...diagnostics });
    return respond(200, { requestId, query, retrievalMode, warning, policies: policies ?? [], ...diagnostics });
  } catch {
    console.error('Retrieval failed', { requestId, stage });

    return respond(500, {
      error: `Retrieval failed at ${stage}.`,
      requestId,
    });
  }
});