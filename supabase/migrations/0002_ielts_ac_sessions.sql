-- IELTS Answer Check Bot — webhook bot uchun sessiya-holati jadvali.
-- Webhook stateless bo'lgani uchun, foydalanuvchining joriy tanlovi (qaysi
-- kitob/test/bo'lim/qism va javob kutilayotgani) shu yerda saqlanadi.
-- RLS yoqilgan, faqat service_role kalit kira oladi.

create table if not exists public.ielts_ac_sessions (
  telegram_id bigint primary key,
  book        smallint,
  test        smallint,
  section     text,
  part        text,
  awaiting    boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.ielts_ac_sessions enable row level security;
