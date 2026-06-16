// IELTS Answer Check — Mini App frontend (statik sahifa).
// Barcha CSS/JS inline qilingan bitta HTML'ni qaytaradi. GitHub Pages kerak emas.
// Mini App URL:  https://<project>.supabase.co/functions/v1/ielts-app
//
// page.ts avtomatik generatsiya qilinadi: python scripts/build_webapp_data.py

import { PAGE } from "./page.ts";

function corsHeaders(): Headers {
  const h = new Headers();
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-headers", "*");
  h.set("access-control-allow-methods", "GET, OPTIONS");
  return h;
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  // HTML sahifani aniq text/html sifatida qaytaramiz (brauzer render qilishi uchun).
  const headers = corsHeaders();
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(PAGE, { status: 200, headers });
});
