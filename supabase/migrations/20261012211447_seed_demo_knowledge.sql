insert into public.knowledge_entries
  (brand_id, category, title, content)
values
-- DS Glasses
(
  '11111111-1111-4111-8111-111111111111',
  'products',
  'What DS Glasses sells',
  'DS Glasses sells glass water bottles, drinking glasses, decorative mirrors, and glass decor. Specific product availability must be checked with an agent; this knowledge base does not provide live inventory.'
),
(
  '11111111-1111-4111-8111-111111111111',
  'returns',
  'Standard returns',
  'Undamaged, unused items in their original packaging may be returned within 7 days of delivery. Custom-made mirrors cannot be returned for a change of mind. Items damaged during delivery follow the damaged-item policy.'
),
(
  '11111111-1111-4111-8111-111111111111',
  'refunds',
  'Refund eligibility and processing',
  'Standard refund requests must be made within 7 days of delivery and require an eligible return. Refunds are processed within 5–7 business days after the returned item passes inspection. Delivery damage follows the damaged-item policy. Do not promise that a refund has been approved or processed before agent confirmation.'
),
(
  '11111111-1111-4111-8111-111111111111',
  'damage',
  'Items broken during delivery',
  'Report delivery damage within 48 hours of delivery and provide photos of the damaged item and packaging. After an agent verifies the damage, the customer may choose a free replacement or a refund. Do not ask customers to ship broken glass back. Reports after 48 hours require agent review; replacement or refund eligibility is not guaranteed.'
),
(
  '11111111-1111-4111-8111-111111111111',
  'shipping',
  'Shipping timelines',
  'Standard glassware is dispatched within 2 business days and usually delivered within 4–6 business days after dispatch. Custom-made mirrors require 7–10 business days before dispatch. These are estimates, not guaranteed arrival dates. Shipping is free on orders of INR 1500 or more; otherwise it costs INR 99.'
),
(
  '11111111-1111-4111-8111-111111111111',
  'cancellation',
  'Order cancellations',
  'Standard orders may be cancelled before dispatch. Custom-made mirror orders may only be cancelled before production starts. If dispatch or production status is unknown, ask an agent to verify it before confirming cancellation.'
),

-- RF Enterprises
(
  '22222222-2222-4222-8222-222222222222',
  'products',
  'What RF Enterprises sells',
  'RF Enterprises sells shirts, T-shirts, trousers, and dresses. Specific sizes, colors, and product availability must be checked with an agent; this knowledge base does not provide live inventory.'
),
(
  '22222222-2222-4222-8222-222222222222',
  'returns',
  'Clothing returns and size exchanges',
  'Unused, unwashed clothing with original tags may be returned or exchanged within 14 days of delivery. Size exchanges depend on stock availability and agent confirmation. Final-sale items cannot be returned or exchanged for a change of mind.'
),
(
  '22222222-2222-4222-8222-222222222222',
  'refunds',
  'Clothing refund eligibility and processing',
  'Refund requests must be made within 14 days of delivery. Clothing must meet the return conditions. Refunds are processed within 3–5 business days after the return passes inspection. Final-sale items are excluded from change-of-mind refunds. Do not claim that a refund has been approved or processed without agent confirmation.'
),
(
  '22222222-2222-4222-8222-222222222222',
  'damage',
  'Damaged or incorrect clothing',
  'Report damaged or incorrect clothing within 7 days of delivery, with photos of the item and its tags. An agent must verify the issue before approving a replacement or refund, including for final-sale items. Reports after 7 days require agent review and have no guaranteed remedy.'
),
(
  '22222222-2222-4222-8222-222222222222',
  'shipping',
  'Clothing shipping',
  'Orders are dispatched within 1 business day and usually delivered within 2–4 business days after dispatch. These are estimates, not guaranteed arrival dates. Shipping is free on orders of INR 999 or more; otherwise it costs INR 49.'
),
(
  '22222222-2222-4222-8222-222222222222',
  'cancellation',
  'Clothing order cancellations',
  'Orders may be cancelled within 2 hours of placement, provided they have not been dispatched. After that window, cancellation is not guaranteed and requires agent review. Verify order time and dispatch status before confirming cancellation.'
);