-- Bot hodisalari (funksiya ishlatilishini kuzatish) + bot egasi uchun analitika RPC.
-- RLS yoqilgan; faqat service_role kalit (bot serveri) yoza/o'qiy oladi.

create table if not exists public.ielts_bot_events (
  id          bigserial primary key,
  telegram_id bigint,
  event       text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists ielts_bot_events_ev_idx
  on public.ielts_bot_events (event, created_at desc);

alter table public.ielts_bot_events enable row level security;

-- Bir chaqiruvda barcha umumiy analitikani qaytaradi (SQL tomonda agregatsiya).
create or replace function public.ielts_bot_admin_stats()
returns jsonb
language sql
security definer
stable
as $$
  select jsonb_build_object(
    'users_total',      (select count(*) from public.ielts_ac_users),
    'users_new_1d',     (select count(*) from public.ielts_ac_users where created_at >= now() - interval '1 day'),
    'users_new_7d',     (select count(*) from public.ielts_ac_users where created_at >= now() - interval '7 days'),
    'users_new_30d',    (select count(*) from public.ielts_ac_users where created_at >= now() - interval '30 days'),
    'users_active_1d',  (select count(*) from public.ielts_ac_users where last_active_at >= now() - interval '1 day'),
    'users_active_7d',  (select count(*) from public.ielts_ac_users where last_active_at >= now() - interval '7 days'),
    'attempts_total',   (select count(*) from public.ielts_ac_attempts),
    'attempts_1d',      (select count(*) from public.ielts_ac_attempts where created_at >= now() - interval '1 day'),
    'attempts_avg_pct', (select coalesce(round(avg(case when total > 0 then correct::numeric * 100 / total else 0 end)), 0)
                         from public.ielts_ac_attempts),
    'cd_created_total', (select count(*) from public.ielts_bot_events where event = 'cd_created'),
    'cd_created_1d',    (select count(*) from public.ielts_bot_events where event = 'cd_created' and created_at >= now() - interval '1 day'),
    'custom_tests',     (select count(*) from public.ielts_ac_custom_tests),
    'drafts_active',    (select count(*) from public.ielts_cd_drafts),
    'top_books',        (select coalesce(jsonb_agg(jsonb_build_object('book', book, 'c', c)), '[]'::jsonb)
                         from (select book, count(*) c from public.ielts_ac_attempts group by book order by count(*) desc limit 5) t),
    'top_sections',     (select coalesce(jsonb_agg(jsonb_build_object('section', section, 'c', c)), '[]'::jsonb)
                         from (select section, count(*) c from public.ielts_ac_attempts group by section order by count(*) desc limit 5) t)
  );
$$;

revoke all on function public.ielts_bot_admin_stats() from public, anon, authenticated;
