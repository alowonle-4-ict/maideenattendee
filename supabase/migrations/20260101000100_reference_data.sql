-- Reference pricing. Every value is editable by the super administrator.
insert into public.subscription_plans
  (name, slug, description, price_ngn, billing_cycle, duration_days,
   max_students, max_lecturers, max_courses, features, is_active, sort_order)
values
  (
    'Starter', 'starter',
    'For small departments and independent lecturers getting started with QR attendance.',
    25000, 'monthly', 30, 100, 5, 20,
    '["QR attendance", "Basic dashboard", "Excel exports", "Email support"]'::jsonb,
    true, 10
  ),
  (
    'Basic', 'basic',
    'For growing institutions that need offline attendance and live dashboards.',
    75000, 'monthly', 30, 500, 30, 100,
    '["Everything in Starter", "Offline attendance", "Real-time dashboards", "Course registers", "Priority support"]'::jsonb,
    true, 20
  ),
  (
    'Professional', 'professional',
    'For established institutions with multiple departments and advanced reporting.',
    200000, 'monthly', 30, 2000, 100, 400,
    '["Everything in Basic", "Department management", "Advanced analytics", "Offline synchronization", "Advanced reporting"]'::jsonb,
    true, 30
  ),
  (
    'Enterprise', 'enterprise',
    'For large institutions and multi-campus groups with white-label requirements.',
    1800000, 'annual', 365, 5000, 300, 1000,
    '["Everything in Professional", "Multiple campuses", "White-label branding", "Priority support", "Custom integrations"]'::jsonb,
    true, 40
  )
on conflict (slug) do nothing;

insert into public.platform_settings (key, value)
values
  ('trial_days', '{"value": 14}'::jsonb),
  ('payment_gateways', '{"paystack": true, "flutterwave": true}'::jsonb),
  ('support_email', '{"value": "support@maideenattendee.app"}'::jsonb)
on conflict (key) do nothing;
