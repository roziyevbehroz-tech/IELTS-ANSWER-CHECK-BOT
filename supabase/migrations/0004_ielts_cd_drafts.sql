-- CD test yaratish oqimi uchun vaqtinchalik holat (draft) jadvali.
-- Har bir foydalanuvchi uchun bitta qatorli qoralama: bosqich + JSON ma'lumot.
-- RLS yoqilgan, public siyosat yo'q — faqat service_role kaliti orqali kirish.

create table if not exists public.ielts_cd_drafts (
    telegram_id bigint primary key,
    step        text not null default '',
    data        jsonb not null default '{}'::jsonb,
    updated_at  timestamptz not null default now()
);

alter table public.ielts_cd_drafts enable row level security;

comment on table public.ielts_cd_drafts is
    'CD (computer-delivered) Reading test yaratish oqimining foydalanuvchi holati.';
