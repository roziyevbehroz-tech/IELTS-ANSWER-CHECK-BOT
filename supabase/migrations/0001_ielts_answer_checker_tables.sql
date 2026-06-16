-- IELTS Answer Check Bot — dedicated tables (namespaced with ielts_ac_ to avoid
-- collisions with existing bot_* tables). RLS is enabled with no public policies,
-- so only the service_role key (used by the bot server) can access these rows.

create table if not exists public.ielts_ac_users (
  telegram_id   bigint primary key,
  username      text,
  first_name    text,
  language_code text,
  created_at    timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table if not exists public.ielts_ac_attempts (
  id          bigserial primary key,
  telegram_id bigint not null references public.ielts_ac_users(telegram_id) on delete cascade,
  book        smallint not null,
  test        smallint not null,
  section     text not null,
  part        text not null,
  correct     smallint not null,
  total       smallint not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists ielts_ac_attempts_tg_idx
  on public.ielts_ac_attempts (telegram_id, created_at desc);

alter table public.ielts_ac_users   enable row level security;
alter table public.ielts_ac_attempts enable row level security;
