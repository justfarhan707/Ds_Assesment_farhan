-- Allow references that enforce matching brand and conversation.
alter table public.messages
  add constraint messages_brand_conversation_id_unique
  unique (brand_id, conversation_id, id);

create table public.reply_generations (
  id uuid primary key default gen_random_uuid(),

  brand_id uuid not null references public.brands(id),
  conversation_id uuid not null,
  customer_message_id uuid not null,
  requested_by uuid not null references auth.users(id),

  -- Client-generated ID, reused when retrying the same request.
  request_key uuid not null,
  unique (requested_by, request_key),

  status text not null default 'pending'
    check (status in (
      'pending', 'draft', 'failed', 'sent', 'superseded'
    )),

  -- Store exactly what the model received.
  customer_message_text text not null,
  conversation_snapshot jsonb not null default '[]'::jsonb
    check (jsonb_typeof(conversation_snapshot) = 'array'),
  order_snapshot jsonb,
  retrieved_context jsonb not null default '[]'::jsonb
    check (jsonb_typeof(retrieved_context) = 'array'),

  -- Store model output separately from subsequent agent edits.
  model_output jsonb,
  ai_response text,
  agent_edited_response text,
  final_response text,

  selected_evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(selected_evidence) = 'array'),

  answerability text
    check (answerability in ('supported', 'partial', 'unsupported')),

  missing_information jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missing_information) = 'array'),

  review_reasons jsonb not null default '[]'::jsonb
    check (jsonb_typeof(review_reasons) = 'array'),

  provider text not null default 'gemini',
  model text not null,
  prompt_version text not null default 'cx-reply-v1',

  retrieval_mode text
    check (retrieval_mode in ('hybrid', 'keyword_only')),

  -- Preserve provider usage, including any thinking-token counts.
  usage_metadata jsonb,
  latency_ms integer check (latency_ms >= 0),

  error_code text,

  final_message_id uuid,
  approved_by uuid references auth.users(id),

  created_at timestamptz not null default now(),
  completed_at timestamptz,
  sent_at timestamptz,

  foreign key (brand_id, conversation_id)
    references public.conversations(brand_id, id),

  foreign key (brand_id, conversation_id, customer_message_id)
    references public.messages(brand_id, conversation_id, id),

  foreign key (brand_id, conversation_id, final_message_id)
    references public.messages(brand_id, conversation_id, id),

  constraint draft_requires_response
    check (
      status not in ('draft', 'sent')
      or (
        ai_response is not null
        and length(trim(ai_response)) > 0
        and answerability is not null
      )
    ),

  constraint sent_requires_final_message
    check (
      status <> 'sent'
      or (
        final_message_id is not null
        and final_response is not null
        and length(trim(final_response)) > 0
        and approved_by is not null
        and sent_at is not null
      )
    ),

  unique (final_message_id)
);

create index reply_generations_conversation_idx
  on public.reply_generations(
    brand_id, conversation_id, created_at desc
  );

alter table public.reply_generations enable row level security;

create policy "Read generations of assigned brand"
  on public.reply_generations
  for select to authenticated
  using (
    exists (
      select 1
      from public.brand_memberships membership
      where membership.brand_id = reply_generations.brand_id
        and membership.user_id = (select auth.uid())
    )
  );

-- Audit records are readable by agents, but aren't directly writable
-- through the browser. Backend functions will perform controlled writes.
revoke insert, update, delete
  on public.reply_generations
  from anon, authenticated;

grant select
  on public.reply_generations
  to authenticated;