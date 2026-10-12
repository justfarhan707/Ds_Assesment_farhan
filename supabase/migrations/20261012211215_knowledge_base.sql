create table public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  category text not null check (
    category in (
      'returns', 'refunds', 'shipping',
      'cancellation', 'products', 'damage'
    )
  ),
  title text not null check (length(trim(title)) > 0),
  content text not null check (
    length(trim(content)) > 0
    and length(content) <= 20000
  ),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_entries_brand_category_idx
  on public.knowledge_entries(brand_id, category);

alter table public.knowledge_entries enable row level security;

create policy "Read assigned brand knowledge"
  on public.knowledge_entries
  for select to authenticated
  using (
    brand_id in (
      select brand_id from public.brand_memberships
      where user_id = (select auth.uid())
    )
  );

create policy "Create assigned brand knowledge"
  on public.knowledge_entries
  for insert to authenticated
  with check (
    brand_id in (
      select brand_id from public.brand_memberships
      where user_id = (select auth.uid())
    )
  );

create policy "Edit assigned brand knowledge"
  on public.knowledge_entries
  for update to authenticated
  using (
    brand_id in (
      select brand_id from public.brand_memberships
      where user_id = (select auth.uid())
    )
  )
  with check (
    brand_id in (
      select brand_id from public.brand_memberships
      where user_id = (select auth.uid())
    )
  );

create policy "Delete assigned brand knowledge"
  on public.knowledge_entries
  for delete to authenticated
  using (
    brand_id in (
      select brand_id from public.brand_memberships
      where user_id = (select auth.uid())
    )
  );

-- Maintain versions and timestamps on the database side.
create function public.track_knowledge_entry_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.brand_id is distinct from old.brand_id then
    raise exception 'Knowledge entry identity and brand cannot change';
  end if;

  new.created_at := old.created_at;

  if row(new.category, new.title, new.content)
     is distinct from row(old.category, old.title, old.content) then
    new.version := old.version + 1;
    new.updated_at := now();
  else
    new.version := old.version;
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

create trigger track_knowledge_entry_update
before update on public.knowledge_entries
for each row execute function public.track_knowledge_entry_update();