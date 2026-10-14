alter table public.reply_generations
  add column previous_conversation_id uuid,
  add column previous_conversation_snapshot jsonb not null default '[]'::jsonb
    check (jsonb_typeof(previous_conversation_snapshot) = 'array'),
  add constraint generation_previous_session_brand_fk
    foreign key (brand_id, previous_conversation_id)
    references public.conversations(brand_id, id);
