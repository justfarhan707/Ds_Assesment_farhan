import { MarkerType, type Node, type Edge } from '@xyflow/react';
export type DesignView = 'flow' | 'database' | 'scale';
export type DesignData = { label: string; kind: string; description: string; fields: string[]; safeguards: string[]; proposed?: boolean };
export type DesignNode = Node<DesignData>;
const node = (id: string, label: string, x: number, y: number, kind: string, description: string, fields: string[], safeguards: string[], proposed = false): DesignNode => ({ id, position: { x, y }, data: { label, kind, description, fields, safeguards, proposed }, style: { width: 210, borderRadius: 12, padding: 18, background: proposed ? '#f8fbff' : '#ffffff', border: `1px ${proposed ? 'dashed' : 'solid'} #cbd8f1`, color: '#10213f', fontSize: 13, fontWeight: 650 } });
const edge = (source: string, target: string, label?: string, sourceHandle = 'out-bottom', targetHandle = 'in-top'): Edge => ({ id: `${source}-${target}`, source, target, label, sourceHandle, targetHandle, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#2563eb', width: 22, height: 22 }, style: { stroke: '#2563eb', strokeWidth: 1.8 }, labelStyle: { fill: '#344054', fontSize: 10 }, labelBgPadding: [6, 4], labelBgBorderRadius: 4, labelBgStyle: { fill: '#ffffff' } });

const flow: DesignNode[] = [
 node('ui','React workspace',0,450,'Frontend','Agent/customer testing views, editable drafts, KB management, and historical context selection.',['React + TypeScript + Vite','Browser API helpers'],['No provider keys in browser','Viewing history does not automatically add AI context']),
 node('auth','Supabase Auth',0,80,'Identity','Signs in agents and provides access tokens.',['Agent login','One brand membership per user'],['Server verifies token','Membership controls brand access']),
 node('generate','generate-reply',360,290,'Edge Function','Loads current conversation and optional same-customer historical context, claims a generation, and orchestrates the draft.',['Recent 30 current messages','Up to 20 historical messages / 24,000 characters','Order facts and delivery age'],['User-scoped reads','Request key prevents duplicate claims','Human approval remains required']),
 node('retrieve','retrieve-knowledge',740,290,'Edge Function','Embeds search queries on cache misses and merges keyword and vector candidates.',['gemini-embedding-001 / 768 dimensions','Full-text + vector search','Up to six candidates'],['Brand-scoped RPC','Ranking is not confidence','Keyword fallback on embedding failure']),
 node('cache','Retrieval cache',1110,290,'PostgreSQL','Stores candidate IDs and scores, then reloads current authorized policy text.',['24-hour fixed TTL','500 entries per brand','Query hash + knowledge/index/config versions'],['No cached customer reply','Revision rechecks','Cache failures fall back to retrieval']),
 node('db','PostgreSQL + pgvector',1510,610,'Persistence','Stores conversations, policies, embeddings, and exact generation evidence.',['RLS policies','Foreign keys','Policy versions'],['Brand ownership enforced','Stale embeddings excluded','Composite keys prevent cross-brand relationships']),
 node('llm','Gemini reply model',740,610,'External API','Writes a structured draft and selects supporting quotes from retrieved candidates.',['REPLY_MODEL backend configuration','Answerability / evidence / missing facts','Usage metadata'],['Backend validates IDs and exact quotes','Prompt requests abstention','Interpretation is probabilistic; not a rule engine']),
 node('approve','approve_reply RPC',360,650,'Atomic transaction','Agent approval creates the final message and saves the edited response in one transaction.',['Brand + conversation + draft locks','Final response and agent identity'],['Rejects changed policies/messages','Repeated approval returns same message','Closed sessions reject new messages']),
 node('index','index-knowledge',740,980,'Ingestion','Embeds policy text when explicitly indexed through the KB UI.',['One entry per request','Sequential Index all batch','Atomic expected-version write'],['Version changed during embedding: write rejected','Already-current entry skips provider','Browser batch stops when page closes']),
];
flow.push(
 node('embed','Gemini embedding API',1110,0,'External API','Shared embedding provider called by both indexing and query retrieval.',['gemini-embedding-001','768-dimensional normalized vectors','RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY'],['Backend-only Gemini key','Query calls avoided on cache hits','Embedding failure: keyword fallback']),
 node('direct','Supabase database API',360,1030,'Direct browser access','The React workspace uses supabase-js to read conversations and history, send manual messages, and create/edit/delete knowledge entries.',['HTTPS database API / PostgREST','Agent token on each request'],['RLS enforces brand membership','Foreign keys and triggers enforce integrity','Privileged service key never reaches browser']),
);
const flowEdges = [
 edge('ui','auth','sign in / token','out-top','in-bottom'),
 edge('ui','generate','generate request','out-right','in-left'),
 edge('generate','retrieve','search question','out-right','in-left'),
 edge('retrieve','generate','candidate evidence','out-bottom','in-bottom'),
 edge('retrieve','cache','lookup / conditional write','out-right','in-left'),
 edge('retrieve','embed','query embedding on miss','out-top','in-left'),
 edge('index','embed','document embedding','out-right','in-bottom'),
 edge('retrieve','db','brand-scoped search + current text','out-bottom','in-top'),
 edge('generate','llm','facts + policies','out-bottom','in-left'),
 edge('llm','generate','structured draft','out-top','in-bottom'),
 edge('generate','db','read context / persist audit','out-top','in-top'),
 edge('ui','approve','approve edited draft','out-bottom','in-left'),
 edge('approve','db','atomic send transaction','out-right','in-left'),
 edge('ui','index','index policy','out-bottom','in-left'),
 edge('index','db','version-checked vector write','out-right','in-bottom'),
 edge('ui','direct','load / manual send / KB CRUD','out-bottom','in-left'),
 edge('direct','db','user-scoped reads and writes (RLS)','out-right','in-bottom'),
];

const tables: [string,string,string[],string][] = [
 ['brands','brands',['PK id','name','knowledge_revision','index_revision'],'Tenant identity and revision counters.'],
 ['members','brand_memberships',['PK brand_id + user_id','UNIQUE user_id','FK auth.users'],'Agents belong to exactly one brand.'],
 ['customers','customers',['PK id','FK brand_id','name / email','UNIQUE brand_id + id'],'Customer records owned by a brand.'],
 ['orders','orders',['PK id','brand_id + customer_id','order_number / item / amount','status / delivered_at'],'Order facts used to interpret customer requests.'],
 ['conversations','conversations',['PK id','brand_id + customer_id + order_id','closed_at / next_session_id','auto_reply_enabled (UI disabled)'],'Active and closed sessions; ending a session preserves audit history.'],
 ['messages','messages',['PK id','brand_id + conversation_id','sender_role / content','created_by / created_at'],'Customer and agent message history.'],
 ['knowledge','knowledge_entries',['PK id / FK brand_id','category / title / content','version / updated_at','generated search_document'],'Editable brand policies; changes advance knowledge revision.'],
 ['embeddings','knowledge_embeddings',['PK/FK entry_id','policy_version / embedding_model','vector(768) / indexed_at'],'Only current policy embeddings participate in retrieval.'],
 ['retrieval_cache','retrieval_cache',['PK id / FK brand_id','query_hash / revision pair / config','candidate IDs + ranking scores','created_at / expires_at'],'Fixed 24-hour cache with per-brand capacity and hourly cleanup.'],
 ['generations','reply_generations',['PK id / FK brand + conversation','source message / unique request key','context + evidence + draft + edits','model / usage / latency / status','final_message_id / approved_by','previous session ID + snapshot'],'Evidence snapshots survive later policy edits and support audit review.'],
];
const database = tables.map(([id,label,fields,description],i) => node(id,label,(i%3)*330,Math.floor(i/3)*190,'Database table',description,fields,['Brand authorization through RLS or checked privileged operations','Columns shown are key fields, not the complete schema']));
const databaseEdges = [edge('brands','members'),edge('brands','customers'),edge('customers','orders'),edge('customers','conversations'),edge('orders','conversations'),edge('conversations','messages'),edge('brands','knowledge'),edge('knowledge','embeddings'),edge('brands','retrieval_cache'),edge('conversations','generations'),edge('messages','generations','source / final'),edge('conversations','conversations','next session')];
const scale = [
 node('channels','Channel adapters',0,180,'Proposed integrations','Verify incoming WhatsApp/email webhooks and translate them to canonical messages.',['Provider event IDs','Signature verification'],['Deduplicate before processing','Credentials scoped per brand'],true),
 node('ingress','API + durable ingress',300,180,'Proposed backend','Authorize tenant operations and persist incoming events before acknowledging them.',['Canonical message schema','Transactional event recording'],['Tenant IDs derived from verified routing','Retries use stable IDs'],true),
 node('queue','Queues + workers',600,180,'Proposed execution','Process generation and indexing independently of request lifetimes.',['Per-brand fairness','Bounded concurrency','Retry backoff / dead-letter queue'],['Provider rate-limit budgets','No unbounded retries','Lease recovery after worker failure'],true),
 node('storage','PostgreSQL + retrieval',900,0,'Scale evolution','Measure hot queries and tenant-filtered search; tune indexes, partition, or separate retrieval when justified.',['App data + policy versions','Incremental indexing','Version-aware exact cache'],['Database connection pooling','Retention / archival','No global cross-brand caches'],true),
 node('providers','Model gateway',900,180,'Proposed AI layer','Apply provider budgets and validated model routing while retaining evidence and policy boundaries.',['Token usage / latency / cost','Timeouts / circuit breakers','Prompt and model versions'],['No blind failover after ambiguous completion','Evaluate models before switching'],true),
 node('outbox','Delivery outbox',900,400,'Proposed delivery','Commit approved reply and delivery intent together; workers deliver externally and reconcile status.',['Provider message IDs','Delivery states','Channel receipts'],['Idempotency where provider supports it','Timeout after send: reconcile before retry'],true),
 node('monitor','Evaluation + operations',600,400,'Proposed observability','Track quality, tenant budgets, backlog, cache hit rate, and delivery failures.',['Regression questions','Policy adherence sampling','Cost per conversation'],['Alert on failures and cost drift','Human review for uncertain responses'],true),
];
const scaleEdges = [edge('channels','ingress'),edge('ingress','queue'),edge('queue','storage'),edge('queue','providers'),edge('queue','outbox'),edge('queue','monitor'),edge('providers','monitor'),edge('outbox','channels','delivery')];
export const designs: Record<DesignView, { nodes: DesignNode[]; edges: Edge[] }> = { flow: { nodes: flow, edges: flowEdges }, database: { nodes: database, edges: databaseEdges }, scale: { nodes: scale, edges: scaleEdges } };
