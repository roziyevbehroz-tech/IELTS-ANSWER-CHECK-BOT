// IELTS Answer Check — Mini App frontend (statik sahifa).
// Barcha CSS/JS inline qilingan bitta HTML'ni qaytaradi. GitHub Pages kerak emas.
// Mini App URL:  https://<project>.supabase.co/functions/v1/ielts-app
//
// page.ts avtomatik generatsiya qilinadi: python scripts/build_webapp_data.py

import { PAGE } from "./page.ts";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=60",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }
  // Har qanday GET so'rovga to'liq sahifani qaytaramiz.
  return new Response(PAGE, { headers: HTML_HEADERS });
});
