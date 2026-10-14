alter table public.brands
  add column index_revision bigint not null default 1;

create table public.retrieval_cache (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  query_hash text not null check (query_hash ~ '^[a-f0-9]{64}$'),
  knowledge_revision bigint not null,
  index_revision bigint not null,
  config_version text not null,

  -- IDs, policy versions, and scores only. No question or policy text.
  candidates jsonb not null
    check (
      jsonb_typeof(candidates) = 'array'
      and jsonb_array_length(candidates) <= 6
    ),

  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),

  unique (
    brand_id, query_hash,
    knowledge_revision, index_revision, config_version
  ),

  check (expires_at = created_at + interval '24 hours')
);

create index retrieval_cache_expiry_idx
  on public.retrieval_cache(expires_at);

alter table public.retrieval_cache enable row level security;

create policy "Read assigned brand cache"
  on public.retrieval_cache
  for select to authenticated
  using (
    exists (
      select 1 from public.brand_memberships membership
      where membership.brand_id = retrieval_cache.brand_id
        and membership.user_id = (select auth.uid())
    )
  );

revoke insert, update, delete
  on public.retrieval_cache from anon, authenticated;

grant select on public.retrieval_cache to authenticated;

-- A successfully changed vector invalidates previous retrieval results.
create function public.bump_index_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.brands brand
  set index_revision = brand.index_revision + 1
  from public.knowledge_entries entry
  where entry.id = new.entry_id
    and brand.id = entry.brand_id;

  return new;
end;
$$;

create trigger bump_index_revision
after insert or update on public.knowledge_embeddings
for each row execute function public.bump_index_revision();

-- User-scoped lookup: RLS still applies.
create function public.get_retrieval_cache(
  p_query_hash text,
  p_config_version text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'candidates', cached.candidates,
    'knowledge_revision', cached.knowledge_revision,
    'index_revision', cached.index_revision
  )
  from public.retrieval_cache cached
  join public.brands brand on brand.id = cached.brand_id
  join public.brand_memberships membership
    on membership.brand_id = brand.id
  where membership.user_id = (select auth.uid())
    and cached.query_hash = p_query_hash
    and cached.config_version = p_config_version
    and cached.knowledge_revision = brand.knowledge_revision
    and cached.index_revision = brand.index_revision
    and cached.expires_at > now()
  limit 1;
$$;

revoke all on function public.get_retrieval_cache(text, text)
  from public, anon;
grant execute on function public.get_retrieval_cache(text, text)
  to authenticated;

-- Backend-only write. Revision checks and capacity enforcement are atomic.
create function public.put_retrieval_cache(
  p_brand_id uuid,
  p_query_hash text,
  p_knowledge_revision bigint,
  p_index_revision bigint,
  p_config_version text,
  p_candidates jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand public.brands;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Backend access required';
  end if;

  select * into v_brand
  from public.brands
  where id = p_brand_id
  for update;

  if not found
     or v_brand.knowledge_revision <> p_knowledge_revision
     or v_brand.index_revision <> p_index_revision then
    return false;
  end if;

  -- Remove expired and obsolete entries for this brand.
  delete from public.retrieval_cache
  where brand_id = p_brand_id
    and (
      expires_at <= now()
      or knowledge_revision <> v_brand.knowledge_revision
      or index_revision <> v_brand.index_revision
      or config_version <> p_config_version
    );

  insert into public.retrieval_cache (
    brand_id, query_hash, knowledge_revision,
    index_revision, config_version, candidates
  )
  values (
    p_brand_id, p_query_hash, p_knowledge_revision,
    p_index_revision, p_config_version, p_candidates
  )
  on conflict (
    brand_id, query_hash,
    knowledge_revision, index_revision, config_version
  ) do nothing;

  -- Retain the newest 500 entries. Concurrent writes serialize above.
  delete from public.retrieval_cache
  where id in (
    select id
    from public.retrieval_cache
    where brand_id = p_brand_id
    order by created_at desc, id desc
    offset 500
  );

  return true;
end;
$$;

revoke all on function public.put_retrieval_cache(
  uuid, text, bigint, bigint, text, jsonb
) from public, anon, authenticated;

grant execute on function public.put_retrieval_cache(
  uuid, text, bigint, bigint, text, jsonb
) to service_role;

-- Scheduled removal; expiry is enforced even if this job is delayed.
create function public.cleanup_retrieval_cache()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.retrieval_cache where expires_at <= now();
$$;

revoke all on function public.cleanup_retrieval_cache()
  from public, anon, authenticated;
grant execute on function public.cleanup_retrieval_cache()
  to service_role;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'cleanup-retrieval-cache',
  '0 * * * *',
  'select public.cleanup_retrieval_cache();'
);