# Javoblar bazasi (Answer Keys) — format

Har bir Cambridge IELTS Academic kitobi uchun bitta JSON fayl:
`data/answers/book_10.json` ... `data/answers/book_20.json`.

Fayllar `scripts/generate_templates.py` orqali bo'sh holatda yaratilgan.
Sizning vazifangiz — bo'sh `""` qiymatlarni **to'g'ri javoblar** bilan to'ldirish.

## Fayl tuzilmasi

```json
{
  "book": 14,
  "tests": {
    "1": {
      "listening": {
        "1": "answer1",
        "2": "answer2",
        ...
        "40": "answer40"
      },
      "reading": {
        "1": "answer1",
        ...
        "40": "answer40"
      }
    },
    "2": { ... },
    "3": { ... },
    "4": { ... }
  }
}
```

- **Listening**: 40 ta savol → Part 1 (1–10), Part 2 (11–20), Part 3 (21–30), Part 4 (31–40)
- **Reading**: 40 ta savol → Passage 1 (1–13), Passage 2 (14–26), Passage 3 (27–40)

Bo'sh qoldirilgan (`""`) savollar "hali kiritilmagan" deb hisoblanadi — bot ularni
tekshirmaydi va o'sha qism uchun "javoblar yo'q" deb ko'rsatadi. Shu sababli
istalgan kitob/test/qismni alohida to'ldirib borishingiz mumkin.

## Javob yozish qoidalari (muhim!)

Bot javoblarni solishtirganda harf katta-kichikligi va ortiqcha bo'shliqlarni
e'tiborsiz qoldiradi. Quyidagi belgilar bilan moslashuvchanlikni oshirasiz:

| Belgi | Ma'nosi | Misol | Qabul qilinadi |
|-------|---------|-------|----------------|
| `/` | muqobil to'g'ri javoblar | `10/ten` | `10` yoki `ten` |
| `( )` | ixtiyoriy so'z(lar) | `(the) ticket` | `ticket` yoki `the ticket` |
| `,` yoki `and` | ko'p tanlovli javob (tartibsiz) | `B,D` yoki `B and D` | `B D`, `D B`, `D, B` ... |

TRUE/FALSE/NOT GIVEN va YES/NO/NOT GIVEN uchun bot qisqartmalarni ham qabul qiladi:
`TRUE`=`T`, `FALSE`=`F`, `NOT GIVEN`=`NG`, `YES`=`Y`, `NO`=`N`.

### Misollar

```json
"1": "library",
"2": "(the) 19th century",
"3": "TRUE",
"4": "B",
"5": "10/ten",
"6": "B,D",
"7": "swimming pool"
```

## Javoblarni to'ldirish

1. Tegishli `book_<N>.json` faylini oching.
2. Kerakli test va bo'limdagi `""` larni to'g'ri javob bilan almashtiring.
3. Faylni saqlang. (Bot keshini yangilash uchun qayta ishga tushiring yoki
   `python -c "from ielts_bot import answer_keys; answer_keys.reload_cache()"`.)

Faqat kerakli qismlarni to'ldirsangiz ham bo'ladi — masalan bugun faqat
14-kitob Test 4 Listening Part 3 ni to'ldirib, qolganini keyin qo'shasiz.

## Excel'dan ommaviy import

Javoblar `data/source/IELTS_answer_data.xlsx` faylidan import qilingan.
Excel formati: `Book | Test | Type | 1 | 2 | ... | 40` (har qator — bitta
kitob/test/bo'lim uchun 40 ta javob, `Type` = Listening yoki Reading).

Qayta import qilish:

```bash
python scripts/import_from_excel.py data/source/IELTS_answer_data.xlsx
```

Skript avtomatik:
- `True`/`False` → `TRUE`/`FALSE`, sonlarni (`2020.0` → `2020`) to'g'rilaydi;
- har bir kitob ichida testlarni `1..4` ga qayta raqamlaydi (mas. Cambridge 12
  Excel'da "Test 5–8" deb belgilangan → bot uchun Test 1–4).

### Hozircha manbada yetishmayotgan javoblar

Quyidagi kataklar Excel manbasining o'zida bo'sh edi (bot ularni tekshirmaydi,
qolgan savollarni tekshiraveradi). Keyinroq to'ldirib qo'ysangiz bo'ladi:

| Kitob | Test | Bo'lim | Savol |
|-------|------|--------|-------|
| 16 | 4 | Reading | 40 |
| 18 | 2 | Reading | 40 |
| 18 | 4 | Reading | 40 |
