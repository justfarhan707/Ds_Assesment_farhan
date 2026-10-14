-- Any KB mutation invalidates drafts for this brand, including additions.
alter table public.brands add column knowledge_revision bigint not null default 1;
alter table public.reply_generations add column knowledge_revision bigint;

create function public.bump_knowledge_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.brands
  set knowledge_revision = knowledge_revision + 1
  where id = case when TG_OP = 'DELETE' then old.brand_id else new.brand_id end;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger bump_knowledge_revision
before insert or update or delete on public.knowledge_entries
for each row execute function public.bump_knowledge_revision();

-- Serialize incoming messages with approval on the conversation row.
create function public.lock_message_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.conversations
  where id = new.conversation_id and brand_id = new.brand_id
  for update;
  new.created_at := clock_timestamp();
  return new;
end;
$$;
create trigger lock_message_conversation
before insert on public.messages
for each row execute function public.lock_message_conversation();

create function public.approve_reply(p_generation_id uuid, p_content text)
returns public.messages
language plpgsql security definer set search_path = '' as $$
declare
  v_generation public.reply_generations;
  v_message public.messages;
  v_revision bigint;
  v_latest uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select generation.* into v_generation
  from public.reply_generations generation
  join public.brand_memberships membership on membership.brand_id = generation.brand_id
  where generation.id = p_generation_id and membership.user_id = auth.uid();
  if not found then raise exception 'Draft unavailable'; end if;

  -- Same lock order for every approval: brand, conversation, generation.
  select knowledge_revision into v_revision from public.brands
  where id = v_generation.brand_id for update;
  perform 1 from public.conversations
  where id = v_generation.conversation_id for update;
  select * into v_generation from public.reply_generations
  where id = p_generation_id for update;

  -- Repeat approval returns the original result without another insert.
  if v_generation.status = 'sent' then
    select * into v_message from public.messages
    where id = v_generation.final_message_id;
    return v_message;
  end if;
  if v_generation.status <> 'draft' then raise exception 'Draft is not available for approval'; end if;
  if p_content is null or length(trim(p_content)) = 0 or length(p_content) > 10000 then
    raise exception 'Reply must contain 1 to 10000 characters';
  end if;
  if v_generation.knowledge_revision is null or v_generation.knowledge_revision <> v_revision then
    raise exception 'Policies changed. Generate a fresh draft';
  end if;

  select id into v_latest from public.messages
  where conversation_id = v_generation.conversation_id
  order by created_at desc, id desc limit 1;
  if v_latest is distinct from v_generation.customer_message_id then
    raise exception 'Conversation changed. Refresh and generate a fresh draft';
  end if;

  insert into public.messages(brand_id, conversation_id, sender_role, content, created_by)
  values(v_generation.brand_id, v_generation.conversation_id, 'agent', trim(p_content), auth.uid())
  returning * into v_message;

  update public.reply_generations set
    status = 'sent',
    agent_edited_response = trim(p_content),
    final_response = trim(p_content),
    final_message_id = v_message.id,
    approved_by = auth.uid(),
    sent_at = now()
  where id = p_generation_id;

  return v_message;
end;
$$;
revoke all on function public.approve_reply(uuid, text) from public, anon;
grant execute on function public.approve_reply(uuid, text) to authenticated;
