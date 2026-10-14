--function to save embeddings 
create function public.save_knowledge_embedding(
  p_entry_id uuid,
  p_expected_version integer,
  p_embedding_model text,
  p_embedding extensions.vector(768)
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Backend access required';
  end if;

  if p_embedding is null
     or p_embedding_model is null
     or length(trim(p_embedding_model)) = 0 then
    raise exception 'Embedding and model are required';
  end if;

  -- Lock the entry to prevent edits racing with this write.
  select version into v_version
  from public.knowledge_entries
  where id = p_entry_id
  for update;

  -- Deleted or edited while the API request was running.
  if not found or v_version <> p_expected_version then
    return false;
  end if;

  insert into public.knowledge_embeddings (
    entry_id,
    policy_version,
    embedding_model,
    embedding,
    indexed_at
  )
  values (
    p_entry_id,
    p_expected_version,
    p_embedding_model,
    p_embedding,
    now()
  )
  on conflict (entry_id) do update
  set
    policy_version = excluded.policy_version,
    embedding_model = excluded.embedding_model,
    embedding = excluded.embedding,
    indexed_at = excluded.indexed_at;

  return true;
end;
$$;

revoke all on function public.save_knowledge_embedding(
  uuid, integer, text, extensions.vector
) from public, anon, authenticated;

grant execute on function public.save_knowledge_embedding(
  uuid, integer, text, extensions.vector
) to service_role;