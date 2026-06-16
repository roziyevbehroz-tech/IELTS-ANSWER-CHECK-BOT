# IELTS Answer Check — Telegram Mini App

Bot ichida ochiladigan chiroyli web-ilova (IELTS klassik qizil dizayn).
Foydalanuvchi kitob → test → bo'lim → Part/Passage tanlaydi, javoblarini
kiritadi va **faqat to'g'ri** javoblari belgilanadi; xato javoblarning to'g'ri
varianti faqat «🔑 Javoblarni ko'rish» bosilganda ochiladi.

## Arxitektura

```
Telegram bot  ──(WebApp tugma)──►  Mini App (GitHub Pages, docs/)
                                        │  fetch + initData
                                        ▼
                          Supabase Edge Function  (ielts-check)
                          • initData'ni HMAC bilan tasdiqlaydi (BOT_TOKEN)
                          • javoblarni SERVERda tekshiradi (answers.json)
                          • faqat to'g'ri raqamlarni qaytaradi
                          • urinishni ielts_ac_attempts ga yozadi
```

- **Frontend** (`docs/`): `index.html`, `styles.css`, `app.js`, `config.js`,
  `catalog.js`. Katalogda faqat savol raqamlari bor — **javoblar yo'q**.
- **Backend** (`supabase/functions/ielts-check/`): `index.ts` + `answers.json`
  (to'liq javoblar faqat serverda).

## 1. Edge Function'ni deploy qilish

[Supabase CLI](https://supabase.com/docs/guides/cli) orqali:

```bash
export BOT_TOKEN="123456:ABC..."        # BotFather tokeni
./scripts/deploy_function.sh
```

Skript: javob-bazasini generatsiya qiladi, loyihaga ulanadi, `BOT_TOKEN`
secret'ini o'rnatadi va funksiyani `--no-verify-jwt` bilan deploy qiladi
(ilova o'zi initData orqali himoyalangani uchun).

Yoki qo'lda:

```bash
python scripts/build_webapp_data.py
supabase link --project-ref zanhdkzevinioaudgdgi
supabase secrets set BOT_TOKEN=123456:ABC...
supabase functions deploy ielts-check --no-verify-jwt
```

Endpoint: `https://zanhdkzevinioaudgdgi.supabase.co/functions/v1/ielts-check`

> `docs/config.js` dagi `apiUrl` shu endpointga to'g'ri kelishi kerak.

## 2. Frontend'ni GitHub Pages'da yoqish

1. GitHub repo → **Settings → Pages**.
2. **Source**: `Deploy from a branch`.
3. **Branch**: `main`, **Folder**: `/docs` → **Save**.
4. Bir-ikki daqiqada manzil tayyor bo'ladi:
   `https://roziyevbehroz-tech.github.io/IELTS-ANSWER-CHECK-BOT/`

## 3. Botda Mini App'ni ulash

`.env` ga qo'shing:

```
WEBAPP_URL=https://roziyevbehroz-tech.github.io/IELTS-ANSWER-CHECK-BOT/
```

So'ng (ixtiyoriy, lekin tavsiya etiladi) BotFather'da Mini App'ni ro'yxatdan
o'tkazing: `/newapp` → botni tanlang → Web App URL sifatida yuqoridagi manzil.
Shunda foydalanuvchilar bot menyusi tugmasidan ham ochishlari mumkin.

Bot `/start` bosilganda «🚀 Mini App'ni ochish» tugmasi chiqadi.

## Ma'lumotni yangilash

Javoblar `data/answers/*.json` da o'zgartirilsa:

```bash
python scripts/build_webapp_data.py      # catalog.js + answers.json yangilanadi
supabase functions deploy ielts-check --no-verify-jwt   # serverni yangilash
git add docs/catalog.js && git commit && git push        # frontend katalogi
```

## Xavfsizlik

- To'liq javoblar (`answers.json`) **faqat Edge Function ichida**, brauzerga
  hech qachon yuborilmaydi. Frontend faqat savol raqamlarini biladi.
- Har bir so'rov Telegram `initData` HMAC-SHA256 imzosi bilan tekshiriladi
  (`BOT_TOKEN` siri bilan) — soxta so'rovlar rad etiladi.
- `reveal` faqat to'g'ri javoblarni qaytaradi (bu foydalanuvchi o'zi so'raganda).
