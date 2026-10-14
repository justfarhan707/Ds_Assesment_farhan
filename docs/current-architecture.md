# CX Assist: current architecture

This diagram documents the implemented code and matches the Application flow view in the app. Layout differs for readability. It is not the Part 2 scale proposal or a live deployment-health report.

```mermaid
flowchart TB
  UI["React + TypeScript · Vercel<br/>Customer preview / Agent workspace / KB editor"]
  AUTH["Supabase Auth<br/>Agent identity and access token"]
  API["Supabase database API<br/>User-scoped reads and writes · RLS"]
  GEN["generate-reply · Edge Function<br/>Authorize, load facts, claim request, validate draft"]
  RET["retrieve-knowledge · Edge Function<br/>Brand-filtered keyword + vector candidates"]
  IDX["index-knowledge · Edge Function<br/>Explicit policy indexing"]
  EMB["Gemini embedding API<br/>gemini-embedding-001 · 768 dimensions"]
  LLM["Gemini reply API<br/>Configured REPLY_MODEL · structured draft"]
  APPROVE["approve_reply · PostgreSQL RPC<br/>Freshness checks + idempotent atomic send"]
  subgraph DATA["Supabase PostgreSQL"]
    DB[("Application data + pgvector<br/>Brand-owned conversations, orders, messages,<br/>versioned policies, embeddings, generation logs")]
    CACHE[("retrieval_cache<br/>Policy IDs + scores · fixed 24-hour TTL<br/>Brand + query hash + revisions + config<br/>500 entries per brand · hourly cleanup")]
  end
  UI -->|Sign in / restore session| AUTH
  UI -->|Read history / manual send / KB CRUD| API
  API -->|Authenticated operations under RLS| DB
  UI -->|Generate or regenerate| GEN
  GEN -->|Read authorized facts / save audit| DB
  GEN -->|Conversation-derived query| RET
  RET -->|Lookup / conditional write| CACHE
  RET -->|On cache miss: query embedding| EMB
  RET -->|Search or reload current cached policies| DB
  RET -->|Candidates + retrieval diagnostics| GEN
  GEN -->|Conversation + order facts + policies| LLM
  LLM -->|Draft + quotes + missing facts / review reasons| GEN
  GEN -->|Saved editable draft + evidence| UI
  UI -->|Index one / sequential batch| IDX
  IDX -->|Document embedding| EMB
  IDX -->|Atomic expected-version vector write| DB
  UI -->|Approve edited response| APPROVE
  APPROVE -->|Insert final message + update audit together| DB
  APPROVE -->|Saved message / existing result on retry| UI
  classDef frontend fill:#e8f0ff,stroke:#2563eb,color:#10213f;
  classDef backend fill:#ffffff,stroke:#cbd8f1,color:#10213f;
  classDef external fill:#eef8f3,stroke:#059669,color:#10213f;
  class UI frontend;
  class AUTH,API,GEN,RET,IDX,APPROVE,DB,CACHE backend;
  class EMB,LLM external;
```

## Boundaries

- Customer mode is a testing view within agent authentication, not a separately authenticated customer portal.
- Browser operations use user tokens and RLS. Privileged backend writes require explicit authorization.
- Selected closed-session history is authorized by brand and customer, bounded, and snapshotted in the generation log.
- Retrieval caches candidates, not replies. Current text is reloaded under user permissions; revisions and expiry are checked.
- Citation validation verifies identifiers and exact quotes; policy interpretation is still probabilistic and requires agent review.
- Zero retrieval candidates produce a backend review fallback without a reply-model call. Embedding failures fall back to keyword search.
- Approval checks knowledge revision and latest message and atomically saves the final message and edits. Repeated approval returns the existing message.
- Indexing is explicitly triggered in the KB UI. The browser batch requires the page to remain open.
- No Redis, external message delivery, automatic refunds, auto-send, durable generation queue, or Realtime subscription is implemented.
