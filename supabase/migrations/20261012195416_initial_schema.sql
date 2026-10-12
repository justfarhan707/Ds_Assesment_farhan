create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint brands_name_not_blank check (length(trim(name)) > 0)
);

create table public.brand_memberships (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id),
  constraint agent_belongs_to_one_brand unique (user_id)
);

-- The unique constraint also indexes user_id; no separate index is needed.

alter table public.brands enable row level security;
alter table public.brand_memberships enable row level security;

-- Users can inspect their own memberships.
create policy "Read own memberships"
  on public.brand_memberships
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Users can read only brands they belong to.
create policy "Read assigned brands"
  on public.brands
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.brand_memberships membership
      where membership.brand_id = brands.id
        and membership.user_id = (select auth.uid())
    )
  );

--agebts can only se their customers.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  name text not null check (length(trim(name)) > 0),
  email text,
  created_at timestamptz not null default now(),

  -- Enables later foreign keys to enforce matching brands.
  unique (brand_id, id)
);

alter table public.customers enable row level security;

create policy "Read customers of assigned brand"
  on public.customers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.brand_memberships membership
      where membership.brand_id = customers.brand_id
        and membership.user_id = (select auth.uid())
    )
  );

create index customers_brand_id_idx
  on public.customers(brand_id);

--composite foreign key oreign key ensures the order's brand_id and customer_id match an actual customer record belonging to that same brand.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  customer_id uuid not null,
  order_number text not null
    check (length(trim(order_number)) > 0),
  item_name text not null
    check (length(trim(item_name)) > 0),
  quantity integer not null default 1 check (quantity > 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  currency text not null default 'INR'
    check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'processing'
    check (status in (
      'processing', 'shipped', 'delivered', 'cancelled'
    )),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),

  unique (brand_id, order_number),
  unique (brand_id, customer_id, id),

  foreign key (brand_id, customer_id)
    references public.customers(brand_id, id),

  constraint delivered_order_requires_date
    check (status <> 'delivered' or delivered_at is not null)
);

alter table public.orders enable row level security;

create policy "Read orders of assigned brand"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.brand_memberships membership
      where membership.brand_id = orders.brand_id
        and membership.user_id = (select auth.uid())
    )
  );

create index orders_brand_customer_idx
  on public.orders(brand_id, customer_id);

--Conversation table

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  customer_id uuid not null,
  order_id uuid,
  auto_reply_enabled boolean not null default false,
  created_at timestamptz not null default now(),

  unique (brand_id, id),

  foreign key (brand_id, customer_id)
    references public.customers(brand_id, id),

  foreign key (brand_id, customer_id, order_id)
    references public.orders(brand_id, customer_id, id)
);

alter table public.conversations enable row level security;

create policy "Read conversations of assigned brand"
  on public.conversations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.brand_memberships membership
      where membership.brand_id = conversations.brand_id
        and membership.user_id = (select auth.uid())
    )
  );

create index conversations_brand_customer_idx
  on public.conversations(brand_id, customer_id);

create index conversations_order_idx
  on public.conversations(brand_id, customer_id, order_id);

--messages.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  conversation_id uuid not null,
  sender_role text not null
    check (sender_role in ('customer', 'agent')),
  content text not null
    check (
      length(trim(content)) > 0
      and length(content) <= 10000
    ),
  created_by uuid not null default auth.uid()
    references auth.users(id),
  created_at timestamptz not null default now(),

  foreign key (brand_id, conversation_id)
    references public.conversations(brand_id, id)
);

create index messages_conversation_history_idx
  on public.messages(brand_id, conversation_id, created_at, id);

alter table public.messages enable row level security;

create policy "Read messages of assigned brand"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.brand_memberships membership
      where membership.brand_id = messages.brand_id
        and membership.user_id = (select auth.uid())
    )
  );

create policy "Send messages within assigned brand"
  on public.messages
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.brand_memberships membership
      where membership.brand_id = messages.brand_id
        and membership.user_id = (select auth.uid())
    )
  );