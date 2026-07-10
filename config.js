// === CONFIGURAÇÃO CENTRAL ===
// Fonte única da URL e da chave "anon public" do Supabase, usada por
// admin.js, view.html, tracker.js e dashboard.html.
// A chave anon é PÚBLICA por design (a proteção real vem das políticas de RLS
// e das funções SECURITY DEFINER no banco). Para trocar de projeto/chave,
// altere APENAS este arquivo.
window.APP_CONFIG = {
  SUPABASE_URL: "https://xkcwidluzrxodaydyxfz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrY3dpZGx1enJ4b2RheWR5eGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTYwNjksImV4cCI6MjA5OTE5MjA2OX0.WcFpRYwnD-_qp_uyl3Va28x-QVdWRpLwZOAOCn_t-48",
  PUBLIC_VIEWER_BASE_URL: "https://PatrickSud.github.io/gerador-de-processos/view.html"
};
