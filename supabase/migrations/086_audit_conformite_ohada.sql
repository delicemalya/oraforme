-- ============================================================
-- Migration 086 — Audit & Conformité OHADA
-- Tables: audit_scores, audit_anomalies
-- ============================================================

-- ─── audit_scores ─────────────────────────────────────────────────────────────
create table if not exists audit_scores (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references profiles(tenant_id) on delete cascade,

  -- Scores par domaine (0-100)
  score_global          int not null default 100,
  score_comptable       int not null default 100,
  score_financier       int not null default 100,
  score_fiscal          int not null default 100,
  score_rh              int not null default 100,
  score_controle_interne int not null default 100,
  score_risques         int not null default 100,
  score_ohada           int not null default 100,

  -- Méta
  nb_anomalies_critical int not null default 0,
  nb_anomalies_error    int not null default 0,
  nb_anomalies_warning  int not null default 0,
  nb_anomalies_info     int not null default 0,

  run_at      timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  -- Un seul enregistrement actif par tenant (upsert)
  unique (tenant_id)
);

-- ─── audit_anomalies ──────────────────────────────────────────────────────────
create table if not exists audit_anomalies (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references profiles(tenant_id) on delete cascade,

  domain      text not null check (domain in (
    'comptable', 'financier', 'fiscal', 'rh', 'controle_interne', 'risques', 'ohada'
  )),
  code        text not null,                           -- ex: 'C001', 'F002', 'RH003'
  titre       text not null,
  description text not null default '',
  niveau      text not null check (niveau in ('critical', 'error', 'warning', 'info')),
  impact      text not null default '',
  recommandation text not null default '',
  valeur      text,                                    -- valeur numérique ou texte contexte
  reference   text,                                    -- référence réglementaire OHADA / DGI

  -- L'anomalie appartient à un audit_score
  audit_run_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_audit_scores_tenant     on audit_scores  (tenant_id);
create index if not exists idx_audit_anomalies_tenant  on audit_anomalies (tenant_id);
create index if not exists idx_audit_anomalies_domain  on audit_anomalies (tenant_id, domain);
create index if not exists idx_audit_anomalies_niveau  on audit_anomalies (tenant_id, niveau);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table audit_scores    enable row level security;
alter table audit_anomalies enable row level security;

-- Politique audit_scores
drop policy if exists "tenant_owns_audit_scores"    on audit_scores;
create policy "tenant_owns_audit_scores" on audit_scores
  for all using (
    tenant_id = (
      select tenant_id from profiles
      where id = auth.uid()
      order by created_at asc limit 1
    )
  );

-- Politique audit_anomalies
drop policy if exists "tenant_owns_audit_anomalies" on audit_anomalies;
create policy "tenant_owns_audit_anomalies" on audit_anomalies
  for all using (
    tenant_id = (
      select tenant_id from profiles
      where id = auth.uid()
      order by created_at asc limit 1
    )
  );

-- ─── Vue agrégée scores + comptage anomalies ──────────────────────────────────
create or replace view audit_dashboard as
select
  s.tenant_id,
  s.score_global,
  s.score_comptable,
  s.score_financier,
  s.score_fiscal,
  s.score_rh,
  s.score_controle_interne,
  s.score_risques,
  s.score_ohada,
  s.nb_anomalies_critical,
  s.nb_anomalies_error,
  s.nb_anomalies_warning,
  s.nb_anomalies_info,
  s.run_at,
  (
    select count(*) from audit_anomalies a
    where a.tenant_id = s.tenant_id
  ) as total_anomalies
from audit_scores s;
