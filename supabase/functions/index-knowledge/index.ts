import { createClient } from 'npm:@supabase/supabase-js@2';

// THis whole file in express equivalant 
//app.post('/index-knowledge', async (req, res) => {
// 1. Authenticate the user
// 2. Fetch the policy from the database
// 3. Ask Gemini to generate an embedding
// 4. Save the embedding to PostgreSQL
// 5. Return the result
//});

const MODEL = 'gemini-embedding-001';

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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!url || !anonKey || !serviceKey || !geminiKey) {
    return respond(500, { error: 'Backend configuration incomplete.' });
  }

  // User-scoped client: database reads remain subject to RLS.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let stage = 'authentication';
  const requestId = crypto.randomUUID();

  try {
    const { data: auth, error: authError } =
      await userClient.auth.getUser();

    if (authError || !auth.user) {
      return respond(401, { error: 'Session expired. Sign in again.' });
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return respond(400, { error: 'Invalid JSON body.' });
    }

    const entryId =
      typeof body === 'object' &&
        body !== null &&
        'entryId' in body
        ? body.entryId
        : null;

    if (
      typeof entryId !== 'string' ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(entryId)
    ) {
      return respond(400, { error: 'A valid entryId is required.' });
    }

    stage = 'policy_lookup';
    const { data: entry, error: entryError } = await userClient
      .from('knowledge_entries')
      .select('id, brand_id, category, title, content, version')
      .eq('id', entryId)
      .maybeSingle();

    if (entryError) throw new Error('Policy lookup failed.');

    // Do not reveal whether an inaccessible entry exists.
    if (!entry) {
      return respond(404, { error: 'Policy unavailable.' });
    }

    stage = 'index_lookup';
    const { data: existing, error: existingError } = await userClient
      .from('knowledge_embeddings')
      .select('policy_version, embedding_model')
      .eq('entry_id', entry.id)
      .maybeSingle();

    if (existingError) throw new Error('Index lookup failed.');

    if (
      existing?.policy_version === entry.version &&
      existing.embedding_model === MODEL
    ) {
      return respond(200, {
        status: 'already_indexed',
        entryId,
        version: entry.version,
      });
    }

    stage = 'embedding_request';
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
            parts: [{
              text: `${entry.title}\nCategory: ${entry.category}\n${entry.content}`,
            }],
          },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: 768,
        }),
        signal: AbortSignal.timeout(25000),
      },
    );

    if (!response.ok) {
      // Log status only; don't expose provider responses or credentials.
      console.error('Embedding provider failed', response.status);

      return respond(response.status === 429 ? 429 : 502, {
        error: response.status === 429
          ? 'Embedding rate limit reached. Retry later.'
          : 'Embedding provider failed. Please retry.',
      });
    }

    stage = 'embedding_validation';
    const result = await response.json();
    const values: unknown = result.embedding?.values;

    if (
      !Array.isArray(values) ||
      values.length !== 768 ||
      !values.every(value =>
        typeof value === 'number' && Number.isFinite(value)
      )
    ) {
      console.error('Invalid embedding shape', { requestId, dimensions: Array.isArray(values) ? values.length : null, responseKeys: Object.keys(result) });
      throw new Error('Invalid embedding response.');
    }

    const norm = Math.hypot(...values);

    if (!Number.isFinite(norm) || norm === 0) {
      throw new Error('Invalid embedding magnitude.');
    }

    const normalized = values.map(value => value / norm);

    // Explicitly recheck membership before the privileged write.
    stage = 'membership_check';
    const { data: membership, error: membershipError } = await userClient
      .from('brand_memberships')
      .select('brand_id')
      .eq('user_id', auth.user.id)
      .eq('brand_id', entry.brand_id)
      .maybeSingle();

    if (membershipError) throw new Error('Access verification failed.');
    if (!membership) {
      return respond(403, { error: 'Brand access unavailable.' });
    }

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    stage = 'embedding_save';
    const { data: saved, error: saveError } = await adminClient.rpc(
      'save_knowledge_embedding',
      {
        p_entry_id: entry.id,
        p_expected_version: entry.version,
        p_embedding_model: MODEL,
        p_embedding: JSON.stringify(normalized),
      },
    );

    if (saveError) {
      console.error('Embedding database write failed', { requestId, code: saveError.code, message: saveError.message });
      throw new Error('Embedding save failed.');
    }

    if (!saved) {
      return respond(409, {
        error: 'Policy changed or was deleted. Reload and retry.',
      });
    }

    return respond(200, {
      status: 'indexed',
      entryId,
      version: entry.version,
      model: MODEL,
    });
  } catch (cause) {
    console.error(
      'Indexing failed',
      { requestId, stage, errorType: cause instanceof Error ? cause.name : 'UnknownError' },
    );

    return respond(500, {
      error: `Indexing failed at ${stage}. Reference: ${requestId}`,
      stage,
      requestId,
    });
  }
});