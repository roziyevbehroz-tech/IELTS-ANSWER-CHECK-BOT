-- Foydalanuvchi tanlagan interfeys tili (uz/ru/en). /start da tanlanadi.
-- Bo'sh bo'lsa standart "uz" ishlatiladi (kod tomonida).

alter table public.ielts_ac_users
  add column if not exists lang text;
