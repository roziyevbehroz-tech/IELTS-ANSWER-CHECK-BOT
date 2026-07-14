"""CD (computer-delivered) IELTS test yaratish tizimi.

Foydalanuvchi yuborgan matn/fayldan haqiqiy IELTS CD formatidagi (mustaqil,
bitta HTML fayl) Reading testini AI'siz, avtomatik quradi.

Bosqichlar:
    extract.py    — fayl (pdf/docx/txt) yoki matndan toza matn
    passage.py    — passage matnini tozalash/formatlash, savollarni ajratish
    questions.py  — 14 xil IELTS savol turini parse qilish (shablon + auto-aniqlash)
    answers.py    — javob shablonini parse qilish
    models.py     — ma'lumot modeli (ReadingTest, Passage, QuestionGroup)
    render.py     — modeldan mustaqil CD HTML fayl generatsiya qilish
    flow.py       — Telegram suhbat oqimi (state machine)
"""
