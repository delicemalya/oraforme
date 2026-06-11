-- ================================================================
-- 088_miaa_agent_autonome.sql
-- Agent Exécutif Autonome MIAA+ — Propositions + Briefings DG
-- ================================================================

-- ── miaa_proposals — Propositions d'actions générées par l'agent ─

create table if not exists miaa_proposals (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references tenants(id) on delete cascade,
  module       text        not null,
  titre        text        not null,
  description  text        not null,
  action_type  text        not null check (action_type in (
                 'relance_facture','alerte_tresorerie','rapport_finance',
                 'rappel_fiscal','analyse_cv','audit_anomalie',
                 'rapport_rh','rappel_cnss','rapport_stock','info'
               )),
  impact       text        not null check (impact in ('critical','high','medium','low')),
  action_label text        not null,
  action_href  text,
  payload      jsonb       not null default '{}'::jsonb,
  statut       text        not null default 'pending'
                           check (statut in ('pending','accepted','rejected','executed')),
  resultat     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table miaa_proposals is 'Propositions d''actions autonomes MIAA+ par tenant';

-- ── miaa_briefings — Briefings DG quotidiens ────────────────────

create table if not exists miaa_briefings (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          uuid        not null references tenants(id) on delete cascade,
  contenu            text        not null,
  modules_analyses   jsonb       not null default '[]'::jsonb,
  nb_propositions    int         not null default 0,
  nb_alertes         int         not null default 0,
  score_sante        int,
  created_at         timestamptz not null default now()
);

comment on table miaa_briefings is 'Briefings DG quotidiens générés par MIAA+';

-- ── RLS ──────────────────────────────────────────────────────────

alter table miaa_proposals  enable row level security;
alter table miaa_briefings   enable row level security;

create policy "miaa_proposals_select" on miaa_proposals
  for select using (
    tenant_id = (select p.tenant_id from profiles p
      where p.user_id = auth.uid() order by p.created_at asc limit 1)
  );
create policy "miaa_proposals_update" on miaa_proposals
  for update using (
    tenant_id = (select p.tenant_id from profiles p
      where p.user_id = auth.uid() order by p.created_at asc limit 1)
  );

create policy "miaa_briefings_select" on miaa_briefings
  for select using (
    tenant_id = (select p.tenant_id from profiles p
      where p.user_id = auth.uid() order by p.created_at asc limit 1)
  );

-- ── Indexes ───────────────────────────────────────────────────────

create index if not exists idx_miaa_proposals_tenant
  on miaa_proposals (tenant_id, statut, created_at desc);
create index if not exists idx_miaa_proposals_impact
  on miaa_proposals (tenant_id, impact, statut)
  where statut = 'pending';
create index if not exists idx_miaa_briefings_tenant
  on miaa_briefings (tenant_id, created_at desc);
