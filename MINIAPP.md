# IELTS Answer Check — Telegram Mini App

Bot ichida ochiladigan chiroyli web-ilova (IELTS klassik qizil dizayn).
Foydalanuvchi kitob → test → bo'lim → Part/Passage tanlaydi, javoblarini
kiritadi va **faqat to'g'ri** javoblari belgilanadi; xato javoblarning to'g'ri
varianti faqat «🔑 Javoblarni ko'rish» bosilganda ochiladi.

## Arxitektura

Frontend ham, API ham **Supabase Edge Functions**'da — GitHub Pages kerak emas,
repo **private** bo'lsa ham ishlaydi.

```
Telegram bot ──(WebApp tugma)──► ielts-app (Edge Function)  ← Mini App frontendi
                                     │  inline HTML/CSS/JS qaytaradi
                                     ▼
                                 (brauzer) ──fetch + initData──►
                          ielts-check (Edge Function)
                          • initData'ni HMAC bilan tasdiqlaydi (BOT_TOKEN)
                          • javoblarni SERVERda tekshiradi (answers.json)
                          • faqat to'g'ri raqamlarni qaytaradi
                          • urinishni ielts_ac_attempts ga yozadi
```

- **Frontend** — `supabase/functions/ielts-app/` (`index.ts` + `page.ts`).
  `page.ts` `docs/` dagi HTML/CSS/JS dan avtomatik generatsiya qilinadi (barchasi
  bitta sahifaga inline). Katalogda faqat savol raqamlari bor — **javoblar yo'q**.
- **Backend** — `supabase/functions/ielts-check/` (`index.ts` + `answers.json`).
  To'liq javoblar **faqat shu yerda**, brauzerga chiqmaydi.
- `docs/` papkasi manba sifatida saqlanadi (GitHub Pages'da ham ishlatsa bo'ladi,
  lekin shart emas).

## 1. Edge Function'ni deploy qilish

### Variant A — Avtomatik (GitHub Actions, tavsiya etiladi)

Repoda `.github/workflows/deploy-edge-function.yml` bor — `main`ga har push'da
funksiyani o'zi deploy qiladi. Bir martalik sozlash:

1. **Supabase Access Token:** Supabase → hisob menyusi → **Access Tokens** →
   *Generate new token* → nusxa oling.
2. **GitHub secret:** repo → **Settings → Secrets and variables → Actions** →
   **New repository secret** → Name: `SUPABASE_ACCESS_TOKEN`, Value: yuqoridagi token.
3. Tayyor. Workflow'ni qo'lda ham ishga tushirish mumkin: **Actions → Deploy
   Edge Function → Run workflow**.

> `BOT_TOKEN` bu yerga emas — u **Supabase Edge Function Secrets**'da turadi.

### Variant B — Qo'lda (Supabase CLI)

[Supabase CLI](https://supabase.com/docs/guides/cli) orqali:

```bash
export BOT_TOKEN="123456:ABC..."        # BotFather tokeni
./scripts/deploy_function.sh
```

Skript: javob-bazasini generatsiya qiladi, loyihaga ulanadi, `BOT_TOKEN`
secret'ini o'rnatadi va funksiyani `--no-verify-jwt` bilan deploy qiladi
(ilova o'zi initData orqali himoyalangani uchun).

Yoki qo'lda (ikkala funksiya):

```bash
python scripts/build_webapp_data.py
supabase link --project-ref zanhdkzevinioaudgdgi
supabase secrets set BOT_TOKEN=123456:ABC...
supabase functions deploy ielts-check --no-verify-jwt   # tekshiruvchi API
supabase functions deploy ielts-app   --no-verify-jwt   # Mini App frontendi
```

Manzillar:
- API:      `https://zanhdkzevinioaudgdgi.supabase.co/functions/v1/ielts-check`
- Mini App: `https://zanhdkzevinioaudgdgi.supabase.co/functions/v1/ielts-app`

> `docs/config.js` dagi `apiUrl` API endpointiga to'g'ri kelishi kerak.

## 2. Mini App URL (GitHub Pages SHART EMAS)

Frontend `ielts-app` funksiyasi orqali beriladi, shuning uchun GitHub Pages
kerak emas (repo private bo'lsa ham ishlaydi). Mini App manzili:

```
https://zanhdkzevinioaudgdgi.supabase.co/functions/v1/ielts-app
```

> Agar GitHub Pages'dan foydalanmoqchi bo'lsangiz (repo public + Pro plan):
> Settings → Pages → Source `main` / `/docs`. Lekin tavsiya — Supabase URL.

## 3. Botda Mini App'ni ulash

`.env` ga (Python botni ishlatsangiz):

```
WEBAPP_URL=https://zanhdkzevinioaudgdgi.supabase.co/functions/v1/ielts-app
```

BotFather'da menyu tugmasi: **@BotFather → /mybots → bot → Bot Settings →
Menu Button** → URL sifatida yuqoridagi Mini App manzilini kiriting (yoki
`/newapp`). Shunda Python botsiz ham Mini App ochiladi.

Bot `/start` bosilganda «🚀 Mini App'ni ochish» tugmasi ham chiqadi.

## Ma'lumotni yangilash

Javoblar `data/answers/*.json` da o'zgartirilsa:

```bash
python scripts/build_webapp_data.py                     # answers.json + catalog + page.ts
supabase functions deploy ielts-check --no-verify-jwt   # API
supabase functions deploy ielts-app   --no-verify-jwt   # frontend (yangi catalog)
git add -A && git commit && git push                    # CI bo'lsa avtomatik deploy
```

## Xavfsizlik

- To'liq javoblar (`answers.json`) **faqat Edge Function ichida**, brauzerga
  hech qachon yuborilmaydi. Frontend faqat savol raqamlarini biladi.
- Har bir so'rov Telegram `initData` HMAC-SHA256 imzosi bilan tekshiriladi
  (`BOT_TOKEN` siri bilan) — soxta so'rovlar rad etiladi.
- `reveal` faqat to'g'ri javoblarni qaytaradi (bu foydalanuvchi o'zi so'raganda).
