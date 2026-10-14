-- Delivery timestamps are fixed when this migration runs.
-- Seeded policies: DS standard refunds 7 days; RF standard refunds 14 days.
-- Current editable KB content remains authoritative if those policies change.
insert into public.customers (id, brand_id, name) values
('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Rohan Desai'),
('a2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Ananya Rao');

insert into public.orders (
  id, brand_id, customer_id, order_number, item_name, quantity,
  total_amount, currency, status, delivered_at, created_at
) values
('b1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
 'a1111111-1111-4111-8111-111111111111', 'DS-20419', 'Drinking Glass Set (6 pieces)',
 1, 1499, 'INR', 'delivered', now() - interval '20 days', now() - interval '26 days'),
('b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
 'a2222222-2222-4222-8222-222222222222', 'RF-10533', 'Cotton T-shirt - Black, Size L',
 1, 799, 'INR', 'delivered', now() - interval '20 days', now() - interval '24 days');

insert into public.conversations (id, brand_id, customer_id, order_id) values
('c1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
 'a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111'),
('c2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
 'a2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222');

-- Same wording, different brand policies. No damage exception is implied.
insert into public.messages (brand_id, conversation_id, sender_role, content, created_by) values
('11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 'customer',
 'I want a refund because I changed my mind. The item is unused, undamaged, and in its original packaging with tags where applicable. Can I return it?',
 'f505b835-281e-4b81-a4ed-c696f42a4f18'),
('22222222-2222-4222-8222-222222222222', 'c2222222-2222-4222-8222-222222222222', 'customer',
 'I want a refund because I changed my mind. The item is unused, undamaged, and in its original packaging with tags where applicable. Can I return it?',
 '6e041a46-f987-405e-98d3-d3d489364156');
