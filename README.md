# CX Assist

A deployed AI-assisted customer-support workspace built for the Datastraw Tech Lead Assessment. Agents can manage brand knowledge, generate replies with inspectable evidence, edit drafts, and approve messages into the conversation.

**Live demo:** https://ds-assesment-farhan.vercel.app/

**Repository:** https://github.com/justfarhan707/Ds_Assesment_farhan

## Demo access

These are intentionally public assessment accounts using mock data.

| Brand | Email | Demo password |
| --- | --- | --- |
| DS Glasses | datastraw@gmail.com | Abc@12345678 |
| RF Enterprises | rf@gmail.com | Abc@12345678 |

The login screen also shows these credentials and can fill them for you. Each agent belongs to exactly one brand. Customer mode is a testing view inside the authenticated workspace, not a separate customer authentication system.

## Features

- Distinct Customer and Agent views with persistent, bidirectional manual messages.
- Customer and order details, including recorded delivery dates.
- Two brands with different return, refund, shipping, cancellation, damage, and product policies.
- Brand-scoped knowledge-base create/edit/delete, with version checks for concurrent edits.
- AI draft generation, regeneration, editable replies, selected policy quotes, missing facts, and review reasons.
- Atomic approval: final message, edited text, and generation status are saved together.
- Closed-session history and explicit selection of previous context for follow-ups.
- Version-aware policy embeddings and hybrid keyword/vector retrieval.
- Exact retrieval cache with a fixed 24-hour lifetime and a 500-entry cap per brand.
- Interactive architecture canvas and clearly labeled illustrative playback.

## Try the demo

1. Sign in to either brand and select a customer.
2. Switch to Customer, send a support question, and return to Agent.
3. Generate a reply and inspect its supporting evidence and review flags.
4. Edit the draft and approve/send. Refresh to verify persistence.
5. Open Knowledge Base to change a policy. Index the changed entry before retesting semantic retrieval.
6. In the retrieval tester, repeat an identical query to inspect cache hits and avoided embedding requests.
7. End a customer session to start fresh. In Agent view, open previous conversations and optionally use one as follow-up context.

DS Glasses includes a broken-bottle scenario; both brands have a second customer whose order was delivered 20 days before the extra-customer seed migration ran. Delivery timestamps are fixed, not reset on every visit. Current editable policies remain authoritative.

## Architecture

- **Frontend:** React, TypeScript, Vite; hosted on Vercel.
- **Identity and data:** Supabase Auth and PostgreSQL, with row-level security (RLS) and composite foreign keys.
- **Backend:** Supabase Edge Functions running on Deno.
- **AI:** Gemini embedding API and a separately configured reply model.
- **Retrieval:** PostgreSQL full-text search plus exact pgvector cosine search, combined using reciprocal rank fusion (RRF).
- **Cache:** PostgreSQL; Redis is not used in the current implementation.

Browser helpers in `src/lib` run as frontend JavaScript and call Supabase over HTTPS. Sensitive provider operations run in Edge Functions.

[Current architecture diagram](docs/current-architecture.jpg) · [Architecture explanation](docs/current-architecture.md)

**Proposed scaled architecture (Part 2):** [Open the Excalidraw diagram](https://excalidraw.com/#json=FWVuSDRapFRSl2QLlEAlZ,zsx3FazTNxtgnVg75KHjfw) — design for 500 brands, 5,000 CX agents, and millions of messages. This describes proposed infrastructure, not the current deployment.

The System Design tab separates current implementation from the proposed scale architecture. Its playback makes no real requests or writes.

### AI flow

1. Authenticate and authorize access to the conversation.
2. Load up to 30 current messages, order facts, and optionally one verified previous session (up to 20 historical messages and 24,000 content characters).
3. Build a search query from the last three customer messages across supplied history/current context, limited to the last 2,000 characters.
4. Check the brand-scoped cache. On a hit, load current authorized policy text from cached IDs. On a miss, embed the query and run hybrid retrieval.
5. Supply candidates and facts to the reply model. It returns a JSON draft, answerability, exact policy quotes, missing information, and review reasons.
6. Validate the response and persist the evidence snapshot, draft, provider usage, and timing.
7. Agent approval checks knowledge revision and the latest message before committing the final response. Repeated approval returns the existing message.

Query embeddings use `gemini-embedding-001` with 768 dimensions. Reply generation uses the server-side `REPLY_MODEL` setting. A moving model alias may change behavior; use a tested pinned model for reproducible evaluation.

### Guardrails and limitations

- Brand isolation is enforced through RLS, membership authorization, and relational constraints.
- Retrieved candidates are not guaranteed relevant evidence. RRF scores are rankings, not confidence.
- Backend checks verify cited policy IDs and exact quotes; they do not prove every claim follows the policy.
- Eligibility, ambiguity, and professional response behavior are model/prompt-based. There is no general deterministic policy interpreter or dedicated profanity filter.
- Missing evidence prompts review. Zero candidates produce a backend fallback without a reply-model call.
- New messages and policy changes invalidate approval of old drafts; changed policies exclude outdated embeddings.
- No auto-send, actual refunds/replacements, WhatsApp/email delivery, or Realtime subscriptions are implemented. Other browser tabs need Refresh.
- Generation is request-driven. Hard interruptions can leave pending records requiring recovery. Concurrent identical retrieval misses can both call the embedding provider.
- Index all is a sequential browser batch; keep the page open. Automatic background indexing is future work.
- Draft edits remain local until approval; the original draft and final submitted wording are persisted, not every intermediate keystroke.

### Cache behavior

The cache key includes brand, normalized query hash, knowledge revision, index revision, and retrieval configuration/model. Normalization preserves case and punctuation while normalizing Unicode and whitespace. Entries hold candidate IDs, policy versions, and ranking metadata, not customer replies or policy text.

Expiry is checked on every lookup and never extended by hits. Policy/index changes invalidate entries earlier. Writes recheck revisions atomically, remove obsolete entries, and enforce capacity. An hourly pg_cron job removes expired rows. Cache failures fall back to ordinary retrieval; keyword-only fallback is not cached.

## Local setup

Use a current Node.js version compatible with the installed Vite release (Node 22.12+ or a compatible newer release), npm, and a Supabase project. Deno is optional for deployment but recommended for Edge Function checking.

```powershell
git clone https://github.com/justfarhan707/Ds_Assesment_farhan.git
cd Ds_Assesment_farhan
npm ci
Copy-Item .env.example .env.local
```

Fill these browser-safe values in `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Do not put provider keys or service-role keys in `VITE_` variables. `.env.local` and CLI temporary state are ignored by Git.

### Database and demo accounts

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

**For a fresh Supabase project:** create the two demo users first in Authentication, with confirmed emails. Before pushing migrations, replace the existing deployment-specific user UUIDs in the seed files with the new users' UUIDs:

- `20261012204202_seed_demo_brands.sql`
- `20261012204524_seed_demo_conversations.sql`
- `20261014120142_seed_expired_refund_customers.sql`

The seeds reference `auth.users`, so those users must exist before application. Do not modify already-applied migrations on the existing deployment; use a new migration for subsequent changes.

```powershell
npx supabase db push --dry-run
npx supabase db push
```

Migrations enable `vector` and `pg_cron` and schedule cache cleanup. Tables include brands, memberships, customers, orders, conversations, messages, knowledge entries, embeddings, reply generations, and retrieval cache. All schema and access policies are version-controlled under `supabase/migrations`.

### Backend configuration and deployment

Add secrets in Supabase → Edge Functions → Secrets:

| Secret | Purpose |
| --- | --- |
| GEMINI_API_KEY | Provider API key for embeddings and replies |
| REPLY_MODEL | Tested Gemini generation model ID; demo has used gemini-flash-lite-latest |

Hosted Supabase functions provide their runtime Supabase URL and database keys. Function handlers authenticate callers with `auth.getUser()`; `verify_jwt = false` disables gateway verification, not application authentication.

```powershell
npx supabase functions deploy index-knowledge
npx supabase functions deploy retrieve-knowledge
npx supabase functions deploy generate-reply
npm run dev
```

After login, index each brand's seeded policies through the Knowledge Base UI.

## Frontend deployment

Import the repository into Vercel with:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | Repository root (where package.json is located) |
| Install command | npm ci |
| Build command | npm run build |
| Output directory | dist |

Set both `VITE_SUPABASE_*` variables in Vercel before building. Backend secrets remain in Supabase. Environment changes require a new frontend build.

## Checks

```powershell
npm run build
npx eslint src
```

The frontend build does not type-check Deno functions. If Deno is installed:

```powershell
deno check --config supabase/functions/index-knowledge/deno.json supabase/functions/index-knowledge/index.ts
deno check --config supabase/functions/retrieve-knowledge/deno.json supabase/functions/retrieve-knowledge/index.ts
deno check --config supabase/functions/generate-reply/deno.json supabase/functions/generate-reply/index.ts
```

Manually verify expired refund windows, missing policies, date conflicts, prompt injection, brand isolation, cache expiry/invalidation, changed drafts, and repeated approval. To test server-side freshness, generate in one tab, change a message or policy in another, and approve without refreshing the original tab. Duplicate-send verification requires replaying the same approval request; a disabled button alone is insufficient.

## Project structure

```text
src/
  components/        Conversation, AI reply, KB, history, architecture UI
  lib/               Browser-side Supabase API helpers
  design/            Version-controlled diagram definitions
  demoAccounts.ts    Public assessment credentials
supabase/
  functions/         index-knowledge, retrieve-knowledge, generate-reply
  migrations/        Schema, RLS, RPCs, triggers, seeds, cache cleanup
docs/                Current architecture diagram and explanation
.env.example         Frontend configuration template
```

## AI-assisted development

Codex was used to discuss architecture, implement frontend components, draft SQL/Edge Functions, and review/debug changes. Gemini supplies application embeddings and reply drafts. A concrete AI-assisted implementation error was the initial embedding request configuration: successful provider responses failed the expected 768-dimension check. The request was corrected and validation retained. Retrieval tests also exposed irrelevant candidates for unsupported questions, leading to explicit evidence-selection and abstention behavior rather than treating similarity as confidence.

With more time, indexing and generation would move to durable jobs with bounded retries, lease recovery, per-brand budgets, and improved evaluation coverage. External delivery would use a transactional outbox and provider-status reconciliation.
