insert into public.brands (id, name)
values
  ('11111111-1111-4111-8111-111111111111', 'DS Glasses'),
  ('22222222-2222-4222-8222-222222222222', 'RF Enterprises');

insert into public.brand_memberships (brand_id, user_id)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'f505b835-281e-4b81-a4ed-c696f42a4f18'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '6e041a46-f987-405e-98d3-d3d489364156'
  );