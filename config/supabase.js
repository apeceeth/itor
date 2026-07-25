/* FevoStable — Supabase config (browser-global for the single-file app).
 * In the Next.js build these come from NEXT_PUBLIC_* env vars (see .env.example);
 * here they are read at runtime so the marketplace can go live without a bundler.
 * Blockchain stays the source of truth — Supabase is only a realtime event mirror. */
window.FEVO_SUPABASE = {
  url: "https://jhpzjvnyiuarsszdrngi.supabase.co",
  anonKey: "sb_publishable_TUnT_gr4QEOHv7PogRpy9Q_tExCgh0s",
  table: "marketplace_events"
};
