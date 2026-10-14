alter table public.conversations add column closed_at timestamptz;
alter table public.conversations add column next_session_id uuid references public.conversations(id);

create or replace function public.lock_message_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_closed timestamptz;
begin
  select closed_at into v_closed from public.conversations
  where id = new.conversation_id and brand_id = new.brand_id for update;
  if not found then raise exception 'Conversation unavailable'; end if;
  if v_closed is not null then raise exception 'Conversation is closed. Start a new session'; end if;
  new.created_at := clock_timestamp();
  return new;
end;
$$;

create function public.end_conversation_session(p_conversation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_old public.conversations; v_next uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select conversation.* into v_old from public.conversations conversation
  join public.brand_memberships membership on membership.brand_id = conversation.brand_id
  where conversation.id = p_conversation_id and membership.user_id = auth.uid()
  for update of conversation;
  if not found then raise exception 'Conversation unavailable'; end if;
  if v_old.next_session_id is not null then return v_old.next_session_id; end if;
  insert into public.conversations(brand_id, customer_id, order_id)
  values(v_old.brand_id, v_old.customer_id, v_old.order_id) returning id into v_next;
  update public.conversations set closed_at = now(), next_session_id = v_next
  where id = v_old.id;
  update public.reply_generations set status = 'superseded'
  where conversation_id = v_old.id and status = 'draft';
  return v_next;
end;
$$;
revoke all on function public.end_conversation_session(uuid) from public, anon;
grant execute on function public.end_conversation_session(uuid) to authenticated;
