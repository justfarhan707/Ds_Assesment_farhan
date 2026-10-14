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
 node('db','PostgreSQL + pgvector',1510,610,'Persistence','Stores conversations, policies, embeddings, and exact generation evidence.',['RLS policies','Foreign keys','Policy versions','Updates in other tabs require Refresh'],['Brand ownership enforced','Stale embeddings excluded','Composite keys prevent cross-brand relationships']),
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
 ['conversations','conversations',['PK id','brand_id + customer_id + order_id','closed_at / next_session_id'],'Active and closed sessions; ending a session preserves audit history.'],
 ['messages','messages',['PK id','brand_id + conversation_id','sender_role / content','created_by / created_at'],'Customer and agent message history.'],
 ['knowledge','knowledge_entries',['PK id / FK brand_id','category / title / content','version / updated_at','generated search_document'],'Editable brand policies; changes advance knowledge revision.'],
 ['embeddings','knowledge_embeddings',['PK/FK entry_id','policy_version / embedding_model','vector(768) / indexed_at'],'Only current policy embeddings participate in retrieval.'],
 ['retrieval_cache','retrieval_cache',['PK id / FK brand_id','query_hash / revision pair / config','candidate IDs + ranking scores','created_at / expires_at'],'Fixed 24-hour cache with per-brand capacity and hourly cleanup.'],
 ['generations','reply_generations',['PK id / FK brand + conversation','source message / unique request key','context + evidence + draft + edits','model / usage / latency / status','final_message_id / approved_by','previous session ID + snapshot'],'Evidence snapshots survive later policy edits and support audit review.'],
];
const database = tables.map(([id,label,fields,description],i) => node(id,label,(i%3)*330,Math.floor(i/3)*190,'Database table',description,fields,['Brand authorization through RLS or checked privileged operations','Columns shown are key fields, not the complete schema']));
// Parent-to-child arrows describe FK relationships, not data-transfer events.
const databaseEdges = [edge('brands','members'),edge('brands','customers'),edge('customers','orders'),edge('customers','conversations'),edge('orders','conversations'),edge('conversations','messages'),edge('brands','knowledge'),edge('knowledge','embeddings'),edge('brands','retrieval_cache'),edge('conversations','generations'),edge('messages','generations','source / final'),edge('conversations','conversations','next session'),edge('brands','orders','brand ownership'),edge('brands','conversations','brand ownership'),edge('brands','generations','brand ownership'),{ ...edge('conversations','generations','previous session context','out-right','in-right'), id: 'conversations-generations-previous' }];
// Proposed scale design follows the Excalidraw left-to-right service layout.
const scale: DesignNode[] = [
 node('s-channels','Customer channels',0,0,'External channels','WhatsApp, website chat, email, and future channels supply authenticated webhook events. Shopify supplies order data through an integration adapter.',['WhatsApp / chat / email','Provider webhook events','Brand-specific integration configuration'],['Verify signatures','Resolve tenant from trusted channel configuration'],true),
 node('s-agents','5,000 CX agents',380,0,'Internal users','Agents work across 500 brands; each account remains assigned to exactly one brand.',['React workspace on Vercel','Conversation / KB / draft review'],['Authorization on every API request','No provider credentials in browser'],true),
 node('s-auth','Supabase Auth',750,0,'Identity','Authenticates agents. Server-side membership and role checks authorize operations.',['Access tokens','Brand membership','Proposed permission roles'],['Authentication is not brand authorization','Privileged operations perform explicit checks'],true),
 node('s-gateway','API gateway / load balancer',160,300,'Ingress routing','Routes customer webhooks to ingestion and agent requests to the CX API. Hosting platform scales stateless instances.',['TLS / routing / health checks','Request rate limits','Edge/WAF protection'],['Nginx alone is not DDoS protection','Separate channel and agent routes'],true),
 node('s-ingest-a','Channel ingestion ? A',0,570,'Stateless replica','Normalizes and validates incoming messages, resolves brand routing, and persists a durable inbox event.',['Validate signatures','Normalize / deduplicate','Persist event + job intent'],['Unique brand + provider event ID','Acknowledge only after durable persistence','Outbox relay recovers publish failures'],true),
 node('s-ingest-b','Channel ingestion ? B',290,570,'Stateless replica','Another replica of the same ingestion service, not a second processing stage.',['Same handlers as replica A','Horizontal scaling','Shared durable deduplication'],['Database uniqueness works across replicas','Duplicate deliveries do not create duplicate messages'],true),
 node('s-api','CX API backend',680,570,'Stateless API','Handles agent REST requests, brand-scoped order lookup, conversation state, and approval. Generation is submitted as a durable job.',['Conversation / order / KB APIs','Generation request + job ID','Approval transaction','SSE/WebSocket notifications'],['Brand authorization + database RLS','Worker results persisted before notification','Stateless instances behind gateway'],true),
 node('s-ai','AI orchestration',1060,570,'Worker-invoked logic','Builds bounded context, retrieves tenant evidence, invokes models, validates outputs, and saves drafts. Logical boundary can initially share the worker codebase.',['Conversation + order + KB context','Evidence validation / fallback','Model usage and prompt versions'],['No automatic financial commitments','Provider timeouts recorded','No blind retries after ambiguous completion'],true),
 node('s-retrieve','Knowledge retrieval',1440,570,'Tenant-scoped search','Checks versioned cache, embeds misses, searches tenant-filtered vectors and text, and returns policy candidates.',['Hybrid search / pgvector','Current text loaded under permissions','Query embeddings on misses'],['Tenant filter applied before ranking','No global customer reply cache','Ranking is not answer confidence'],true),
 node('s-queue','Durable message queues',160,920,'Async execution','Separate queues isolate message ingestion, indexing, generation, and delivery workloads. Durable inbox/outbox state recovers missing job publication.',['message / generation queues','indexing / send queues','Retry scheduling / dead-letter queue'],['Per-brand fairness / concurrency limits','Jobs carry tenant IDs; workers recheck scope','Backoff, leases, and poison-job isolation'],true),
 node('s-outbox','Transactional outbox',680,920,'Delivery state','Approval writes final message and delivery intent in one database transaction; a relay publishes delivery jobs. Also supports reliable event-to-job publication.',['Pending / sending / delivered / failed','Provider IDs / receipt correlation','Outbox relay'],['Commit before sending externally','Ambiguous send timeout: reconcile first','Idempotency where provider supports it'],true),
 node('s-provider','Gemini / model APIs',1060,920,'External providers','Return generation outputs and embeddings to workers. Providers do not connect directly to the application database.',['Configured generation models','Document / query embeddings','Provider quotas / budgets'],['Secrets stored server-side','Model behavior evaluated before changes','Worker writes vectors and audit records'],true),
 node('s-redis','Redis retrieval cache',1440,920,'Proposed optimization','Optional disposable cache if measurements justify moving the current PostgreSQL cache. PostgreSQL remains authoritative.',['Brand + query hash + revisions','24-hour TTL / capacity limits','Candidate IDs + scores'],['Fresh policy text reloaded','Eviction or outage falls back to search','No personalized reply reuse'],true),
 node('s-workers','Background workers',160,1240,'Autoscaled consumers','Worker pools consume durable jobs for inbound events, AI drafts, and policy indexing; enforce tenant budgets.',['Index current policy version','Generate drafts asynchronously','Retry / DLQ handling','Cleanup / maintenance'],['Expected-version embedding writes','Claim jobs once per lease','Recover interrupted work explicitly'],true),
 node('s-db','PostgreSQL + pgvector',680,1240,'Authoritative persistence','Stores tenant-owned application data, versioned knowledge, durable event/outbox state, and exact AI evidence snapshots.',['Brands / memberships / customers','Orders / conversations / messages','Policies / embeddings / audit logs','Inbox / outbox / job state'],['RLS + composite foreign keys','Connection pooling / query indexes','Measure search; partition or separate retrieval when needed','Backups, retention, archival'],true),
 node('s-send','Channel delivery workers',1060,1240,'External delivery','Consume approved delivery jobs, call channel APIs, persist provider IDs, and handle receipts/reconciliation.',['WhatsApp / email / chat adapters','Send attempts and delivery receipts'],['Delivery is separate from generation','Do not resend blindly after timeouts','Exactly-once external delivery is not guaranteed'],true),
 node('s-ops','Monitoring + evaluation',160,1560,'Operations','Measures reliability and cost across services and tenants; samples responses for policy adherence.',['Queue backlog / retry age','Token cost / latency / cache hits','Trace request ? draft ? delivery','Regression and isolation evaluations'],['Alert on tenant budget drift','Human review for uncertainty','Metrics contain no unnecessary customer content'],true),
];
const scaleEdges: Edge[] = [
 edge('s-channels','s-gateway','webhooks'),edge('s-agents','s-auth','sign in','out-right','in-left'),
 edge('s-agents','s-gateway','agent HTTPS'),edge('s-gateway','s-ingest-a','channel route'),edge('s-gateway','s-ingest-b','replica route'),
 edge('s-gateway','s-api','agent API route','out-right','in-top'),
 edge('s-ingest-a','s-db','durable inbox + publication intent','out-left','in-left'),
 edge('s-ingest-b','s-queue','publish via outbox relay'),edge('s-ingest-a','s-queue','publish via outbox relay'),
 edge('s-api','s-queue','generation / indexing job','out-left','in-right'),edge('s-queue','s-workers','consume leased jobs'),
 edge('s-workers','s-ai','invoke generation pipeline','out-right','in-top'),edge('s-ai','s-retrieve','search context','out-right','in-left'),
 edge('s-retrieve','s-ai','evidence candidates','out-bottom','in-bottom'),edge('s-ai','s-provider','generate request'),
 edge('s-retrieve','s-provider','embed query on miss','out-left','in-right'),
 edge('s-workers','s-provider','embed documents','out-right','in-left'),edge('s-workers','s-db','versioned vectors / job state','out-right','in-left'),
 edge('s-ai','s-db','facts / draft / audit','out-left','in-top'),edge('s-retrieve','s-db','tenant-filtered search','out-right','in-right'),
 edge('s-retrieve','s-redis','cache lookup / write'),edge('s-api','s-db','brand-scoped reads','out-right','in-top'),
 edge('s-api','s-outbox','approval commits reply + intent'),edge('s-outbox','s-db','same PostgreSQL transaction'),
 edge('s-outbox','s-queue','relay send job','out-left','in-right'),edge('s-queue','s-send','delivery jobs','out-right','in-left'),
 edge('s-send','s-channels','send + receipts','out-right','in-left'),edge('s-send','s-db','provider IDs / reconciliation','out-left','in-right'),
 edge('s-workers','s-ops','metrics / traces'),edge('s-ai','s-api','notify saved draft','out-top','in-right'),
];
export const designs: Record<DesignView, { nodes: DesignNode[]; edges: Edge[] }> = { flow: { nodes: flow, edges: flowEdges }, database: { nodes: database, edges: databaseEdges }, scale: { nodes: scale, edges: scaleEdges } };
