#!/usr/bin/env bash
# IELTS Answer Check — Edge Function'ni Supabase'ga deploy qilish.
#
# Talab: Supabase CLI o'rnatilgan bo'lishi kerak.
#   https://supabase.com/docs/guides/cli
#
# Foydalanish:
#   export BOT_TOKEN="123456:ABC..."          # BotFather tokeni
#   ./scripts/deploy_function.sh
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-zanhdkzevinioaudgdgi}"
FUNC="ielts-check"

cd "$(dirname "$0")/.."

# 1) Eng so'nggi javob-bazasini generatsiya qilish (data/answers -> answers.json)
echo "▶ Javob-bazasi generatsiya qilinmoqda…"
python scripts/build_webapp_data.py

# 2) Loyihaga ulanish
echo "▶ Supabase loyihasiga ulanish ($PROJECT_REF)…"
supabase link --project-ref "$PROJECT_REF"

# 3) BOT_TOKEN secret (initData'ni tasdiqlash uchun)
if [[ -n "${BOT_TOKEN:-}" ]]; then
  echo "▶ BOT_TOKEN secret o'rnatilmoqda…"
  supabase secrets set "BOT_TOKEN=$BOT_TOKEN" --project-ref "$PROJECT_REF"
else
  echo "⚠ BOT_TOKEN o'rnatilmadi. Keyin qo'lda: supabase secrets set BOT_TOKEN=..."
fi

# 4) Funksiyani deploy qilish (--no-verify-jwt: ommaviy, o'zi initData bilan himoyalanadi)
echo "▶ '$FUNC' funksiyasi deploy qilinmoqda…"
supabase functions deploy "$FUNC" --no-verify-jwt --project-ref "$PROJECT_REF"

echo "✅ Tayyor. Endpoint:"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/$FUNC"
