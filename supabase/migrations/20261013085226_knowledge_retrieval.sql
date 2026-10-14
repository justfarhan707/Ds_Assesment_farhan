
-- create the embeding table 
create extension if not exists vector with schema extensions;

create table public.knowledge_embeddings (
  entry_id uuid primary key
    references public.knowledge_entries(id) on delete cascade,
  policy_version integer not null check (policy_version > 0),
  embedding_model text not null,
  embedding extensions.vector(768) not null,
  indexed_at timestamptz not null default now()
);

alter table public.knowledge_embeddings enable row level security;

-- The referenced policy's RLS determines visibility.
--Check whether the corresponding policy exists in knowledge_entries and is visible to the current user under that table's access rules.
create policy "Read embeddings of assigned brand"
  on public.knowledge_embeddings
  for select to authenticated
  using (
    exists (
      select 1
      from public.knowledge_entries entry
      where entry.id = knowledge_embeddings.entry_id
    )
  );

-- No browser insert/update/delete policies.
-- The indexing backend will write embeddings after authorization.

alter table public.knowledge_entries
  add column search_document tsvector
  generated always as (
    setweight(
      to_tsvector('english'::regconfig, coalesce(title, '')),
      'A'
    )
    ||
    setweight(
      to_tsvector('english'::regconfig, coalesce(content, '')),
      'B'
    )
  ) stored;

create index knowledge_entries_search_idx
  on public.knowledge_entries using gin(search_document);

create function public.search_knowledge(
  p_query text,
  p_query_embedding extensions.vector(768),
  p_embedding_model text,
  p_limit integer default 6
)
returns table (
  entry_id uuid,
  category text,
  title text,
  content text,
  policy_version integer,
  retrieval_score double precision,
  semantic_similarity double precision,
  keyword_match boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with authorized_entries as materialized (
    select entry.*
    from public.knowledge_entries entry
    join public.brand_memberships membership
      on membership.brand_id = entry.brand_id
    where membership.user_id = (select auth.uid())
  ),
  keyword_candidates as (
    select
      entry.id,
      row_number() over (
        order by
          ts_rank_cd(
            entry.search_document,
            websearch_to_tsquery('english'::regconfig, p_query)
          ) desc,
          entry.id
      ) as position
    from authorized_entries entry
    where entry.search_document @@
      websearch_to_tsquery('english'::regconfig, p_query)
    order by position
    limit 20
  ),
  vector_candidates as (
    select
      entry.id,
      1 - (
        stored.embedding OPERATOR(extensions.<=>) p_query_embedding
      ) as similarity,
      row_number() over (
        order by
          stored.embedding OPERATOR(extensions.<=>) p_query_embedding,
          entry.id
      ) as position
    from authorized_entries entry
    join public.knowledge_embeddings stored
      on stored.entry_id = entry.id
      and stored.policy_version = entry.version
      and stored.embedding_model = p_embedding_model
    where p_query_embedding is not null
    order by position
    limit 20
  ),
  combined as (
    select
      coalesce(keyword.id, semantic.id) as id,
      (
        coalesce(1.0 / (60 + keyword.position), 0)
        +
        coalesce(1.0 / (60 + semantic.position), 0)
      )::double precision as score,
      semantic.similarity,
      keyword.id is not null as matched_keyword
    from keyword_candidates keyword
    full outer join vector_candidates semantic
      on semantic.id = keyword.id
  )
  select
    entry.id,
    entry.category,
    entry.title,
    entry.content,
    entry.version,
    combined.score,
    combined.similarity,
    combined.matched_keyword
  from combined
  join authorized_entries entry on entry.id = combined.id
  order by combined.score desc, entry.id
  limit greatest(1, least(coalesce(p_limit, 6), 20));
$$;

revoke all on function public.search_knowledge(
  text, extensions.vector, text, integer
) from public, anon;

grant execute on function public.search_knowledge(
  text, extensions.vector, text, integer
) to authenticated; 