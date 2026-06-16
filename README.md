# IELTS Answer Check Bot 🤖📚

Cambridge IELTS **Academic 10–20** kitoblari bo'yicha **Listening** va **Reading**
testlari javoblarini tekshirib beruvchi Telegram bot.

O'quvchi istalgan practice testni mustaqil ishlab bo'lgach, javoblarini tartib
raqami bilan botga yuboradi. **Bot faqat _to'g'ri_ javoblarni ko'rsatadi** —
xato javoblarning to'g'ri variantini darrov oshkor qilmaydi. O'quvchi xatolari
ustida yana ishlaydi va tayyor bo'lganda «🔑 Javoblarni ko'rish» tugmasi orqali
barcha to'g'ri javoblarni ko'radi.

## ✨ Telegram Mini App

Botda chiroyli **Mini App** (IELTS qizil dizayn) ham bor — kitob/test/qism
tanlash va javob tekshirish endi qulay web-interfeysda. Tekshirish server
tomonida (Supabase Edge Function) bo'ladi, javoblar brauzerga chiqmaydi.
To'liq sozlash: [`MINIAPP.md`](MINIAPP.md).

## Imkoniyatlar

- 📱 Telegram Mini App (WebApp) + klassik matnli bot rejimi
- 📚 11 ta kitob (Cambridge IELTS Academic 10–20), har birida 4 ta test
- 🎧 Listening (Part 1–4) va 📖 Reading (Passage 1–3) — yoki to'liq test (1–40)
- ✅ Faqat to'g'ri javoblar ko'rsatiladi, xatolar yashiriladi
- 🔁 «Qaytadan urinish» — xatolar ustida ishlab, qayta yuborish
- 🔑 «Javoblarni ko'rish» — foydalanuvchi xohlaganda to'liq javoblar
- 🤝 Moslashuvchan javob tekshirgich: katta-kichik harf, muqobil javoblar (`10/ten`),
  ixtiyoriy so'zlar (`(the) ticket`), TRUE/FALSE/NG qisqartmalari, ko'p tanlovli javoblar
- 📈 Foydalanuvchi statistikasi (Supabase orqali, ixtiyoriy)

## Loyiha tuzilmasi

```
run.py                       # ishga tushirish nuqtasi
ielts_bot/
  config.py                  # sozlamalar (.env dan o'qiladi)
  answer_keys.py             # javob-kalitlarni yuklash, Part/Passage diapazonlari
  parsing.py                 # foydalanuvchi matnidan raqamlangan javoblarni ajratish
  checker.py                 # solishtirish mantig'i (faqat to'g'rilarni qaytaradi)
  keyboards.py               # inline tugmalar
  texts.py                   # o'zbekcha interfeys matnlari
  database.py                # Supabase (ixtiyoriy)
  handlers.py                # Telegram handlerlari
data/answers/book_10..20.json # javob-kalitlar (siz to'ldirasiz) — format: data/README.md
scripts/generate_templates.py # bo'sh shablonlarni qayta yaratish
supabase/migrations/         # baza sxemasi
tests/test_checker.py        # birlik testlar
```

## O'rnatish

```bash
python3 -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # va .env ni to'ldiring
```

### `.env` sozlamalari

| O'zgaruvchi | Tavsif |
|-------------|--------|
| `BOT_TOKEN` | @BotFather dan olingan token (**majburiy**) |
| `SUPABASE_URL` | Supabase loyiha URL (ixtiyoriy) |
| `SUPABASE_SERVICE_KEY` | Supabase `service_role` kaliti (ixtiyoriy, statistika uchun) |

> Supabase sozlanmasa ham bot ishlaydi — shunchaki statistika saqlanmaydi.

## Javoblar bazasini to'ldirish

Javob-kalitlar `data/answers/book_<N>.json` fayllarida. Hozircha **bo'sh** —
to'g'ri javoblarni siz kiritasiz. To'liq format va qoidalar: [`data/README.md`](data/README.md).

Bo'sh qoldirilgan savollar tekshirilmaydi, shuning uchun kitoblarni bosqichma-bosqich
to'ldirib borishingiz mumkin.

## Ishga tushirish

```bash
python run.py
```

Foydalanish:
1. `/start` → kitob → test → bo'lim (Listening/Reading) → qism (Part/Passage)
2. O'sha qismni o'zingiz yeching
3. Javoblarni raqami bilan yuboring (`21. cat`)
4. Bot to'g'ri javoblaringizni ko'rsatadi → xatolar ustida ishlang → qayta yuboring
5. Tayyor bo'lsangiz «🔑 Javoblarni ko'rish»

Buyruqlar: `/start`, `/help`, `/stats`

## Testlar

```bash
python tests/test_checker.py
```

## Baza (Supabase)

Bot uchun ikkita jadval ishlatiladi (mavjud jadvallaringizga tegmaslik uchun
`ielts_ac_` prefiksi bilan): `ielts_ac_users`, `ielts_ac_attempts`. Sxema
`supabase/migrations/0001_ielts_answer_checker_tables.sql` da. RLS yoqilgan,
public siyosatlar yo'q — faqat `service_role` kaliti orqali kirish mumkin.
