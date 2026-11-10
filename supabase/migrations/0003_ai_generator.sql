-- =============================================================
-- DevisVite — Phase 3 : générateur IA
-- =============================================================

-- Le plafond de dépense IA est configurable par entreprise (0,50 € par défaut)
alter table public.companies alter column ai_budget_cents_month set default 50;

-- Historique : nouveaux types d'événements liés à l'IA (event_type est un enum)
alter type public.event_type add value if not exists 'ai_generated';
alter type public.event_type add value if not exists 'ai_retried';
