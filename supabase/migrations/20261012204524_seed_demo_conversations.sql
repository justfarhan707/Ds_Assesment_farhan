insert into public.customers (id, brand_id, name)
values
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'Priya Sharma'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'Arjun Mehta'
  );

insert into public.orders (
  id, brand_id, customer_id, order_number,
  item_name, quantity, total_amount, currency,
  status, delivered_at, created_at
)
values
  (
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'DS-20418', 'Glass Water Bottle 750ml',
    1, 899.00, 'INR', 'delivered',
    now() - interval '1 day',
    now() - interval '5 days'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '22222222-2222-4222-8222-222222222222',
    '44444444-4444-4444-8444-444444444444',
    'RF-10532', 'Cotton Shirt — Blue, Size M',
    1, 1299.00, 'INR', 'delivered',
    now() - interval '3 days',
    now() - interval '7 days'
  );

insert into public.conversations (
  id, brand_id, customer_id, order_id
)
values
  (
    '77777777-7777-4777-8777-777777777777',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555'
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    '22222222-2222-4222-8222-222222222222',
    '44444444-4444-4444-8444-444444444444',
    '66666666-6666-4666-8666-666666666666'
  );

insert into public.messages (
  brand_id, conversation_id, sender_role, content, created_by
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '77777777-7777-4777-8777-777777777777',
    'customer',
    'My order was delivered but the bottle is broken. What can I do?',
    'f505b835-281e-4b81-a4ed-c696f42a4f18'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '88888888-8888-4888-8888-888888888888',
    'customer',
    'The shirt I received is too small. Can I exchange it?',
    '6e041a46-f987-405e-98d3-d3d489364156'
  );