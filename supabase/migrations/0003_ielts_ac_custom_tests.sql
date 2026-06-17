-- Foydalanuvchi yaratadigan testlar (har kim yarata oladi) va ularga kelgan javoblar.
-- RLS yoqilgan, faqat service_role (Edge Function) kira oladi.

create table if not exists public.ielts_ac_custom_tests (
  id          text primary key,                 -- qisqa kod (havola uchun)
  owner_id    bigint not null,                  -- yaratuvchi telegram_id
  owner_name  text,
  title       text not null,
  answers     jsonb not null default '{}'::jsonb, -- {"1":"cat","2":"TRUE", ...}
  status      text not null default 'active',   -- active | paused | closed
  closes_at   timestamptz,                      -- ixtiyoriy muddat
  created_at  timestamptz not null default now()
);
create index if not exists ielts_ac_ct_owner_idx
  on public.ielts_ac_custom_tests (owner_id, created_at desc);

create table if not exists public.ielts_ac_custom_submissions (
  id          bigserial primary key,
  test_id     text not null references public.ielts_ac_custom_tests(id) on delete cascade,
  telegram_id bigint not null,
  username    text,
  first_name  text,
  score       smallint not null,
  total       smallint not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ielts_ac_ct_sub_test_idx
  on public.ielts_ac_custom_submissions (test_id, created_at desc);

alter table public.ielts_ac_custom_tests       enable row level security;
alter table public.ielts_ac_custom_submissions enable row level security;
