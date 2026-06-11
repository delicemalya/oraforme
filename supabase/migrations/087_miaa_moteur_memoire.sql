-- ================================================================
-- 087_miaa_moteur_memoire.sql
-- Moteur de Mémoire Persistante MIAA+ — Oraforme ERP
-- 4 tables manquantes identifiées par audit : memory, notifications,
-- rapports, alertes
-- Multi-tenant : isolation par tenant_id via RLS
-- ================================================================

-- ── 1. miaa_memory — Mémoire d'apprentissage 1:1 par entreprise ──

create table if not exists miaa_memory (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null unique,
  historique_resume text        not null default '',
  nb_conversations  int         not null default 0,
  patterns          jsonb       not null default '{"questions_frequentes":[],"problemes_recurrents":[],"preferences_utilisateur":[]}'::jsonb,
  contexte_metier   jsonb       not null default '{}'::jsonb,
  derniere_analyse  timestamptz,
  updated_at        timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

comment on table  miaa_memory                  is 'Mémoire persistante 1:1 par entreprise — apprentissage MIAA+';
comment on column miaa_memory.historique_resume is 'Rolling buffer des 30 derniers échanges (max 3000 chars)';
comment on column miaa_memory.patterns          is 'Patterns extraits : questions fréquentes, problèmes récurrents, préférences';
comment on column miaa_memory.contexte_metier   is 'Contexte métier enrichi : modules utilisés, langue, secteur focus';

-- ── 2. miaa_notifications — Alertes persistantes multi-tenant ────

create table if not exists miaa_notifications (
  id           text        not null,
  tenant_id    uuid        not null references tenants(id) on delete cascade,
  type         text        not null check (type in ('fiscal','tresorerie','rh','stock','facture','info')),
  priority     text        not null check (priority in ('critical','high','medium','low')),
  titre        text        not null,
  message      text        not null,
  action_url   text,
  action_label text,
  lu           boolean     not null default false,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  primary key (id, tenant_id)
);

comment on table miaa_notifications is 'Alertes proactives persistées (fiscal, trésorerie, RH, stock, factures)';

-- ── 3. miaa_rapports — Rapports générés par MIAA+ ────────────────

create table if not exists miaa_rapports (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references tenants(id) on delete cascade,
  type         text        not null check (type in (
                 'rapport_mensuel','rapport_tresorerie','rapport_stock',
                 'bulletin_paie','bilan_simplifie','rapport_audit',
                 'relance_facture','contrat_travail','rapport_rh','rapport_fiscal'
               )),
  contenu      text        not null,
  meta         jsonb       not null default '{}'::jsonb,
  tokens_used  int,
  auto         boolean     not null default false,
  created_at   timestamptz not null default now()
);

comment on table  miaa_rapports       is 'Rapports MIAA+ générés (manuels ou automatiques via cron)';
comment on column miaa_rapports.auto  is 'true = généré automatiquement par le cron autonome';
comment on column miaa_rapports.meta  is 'Métadonnées : module, contexte, prompt_version';

-- ── 4. miaa_alertes — Alertes proactives cron (horaire) ──────────

create table if not exists miaa_alertes (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          uuid        not null references tenants(id) on delete cascade,
  contenu            text        not null,
  alertes_detectees  jsonb       not null default '[]'::jsonb,
  lu                 boolean     not null default false,
  created_at         timestamptz not null default now()
);

comment on table  miaa_alertes                   is 'Alertes proactives générées par le cron horaire MIAA+';
comment on column miaa_alertes.alertes_detectees is 'JSON des anomalies détectées [{type, message}]';

-- ================================================================
-- RLS — Row Level Security (isolation multi-tenant stricte)
-- Service_role bypass RLS automatically → no explicit policy needed
-- ================================================================

alter table miaa_memory        enable row level security;
alter table miaa_notifications  enable row level security;
alter table miaa_rapports       enable row level security;
alter table miaa_alertes        enable row level security;

-- ── miaa_memory ───────────────────────────────────────────────────

create policy "miaa_memory_tenant_select" on miaa_memory
  for select using (
    tenant_id = (
      select p.tenant_id from profiles p
      where p.user_id = auth.uid()
      order by p.created_at asc limit 1
    )
  );

create policy "miaa_memory_tenant_update" on miaa_memory
  for update using (
    tenant_id = (
      select p.tenant_id from profiles p
      where p.user_id = auth.uid()
      order by p.created_at asc limit 1
    )
  );

-- ── miaa_notifications ────────────────────────────────────────────

create policy "miaa_notif_tenant_select" on miaa_notifications
  for select using (
    tenant_id = (
      select p.tenant_id from profiles p
      where p.user_id = auth.uid()
      order by p.created_at asc limit 1
    )
  );

create policy "miaa_notif_tenant_update" on miaa_notifications
  for update using (
    tenant_id = (
      select p.tenant_id from profiles p
      where p.user_id = auth.uid()
      order by p.created_at asc limit 1
    )
  );

-- ── miaa_rapports ─────────────────────────────────────────────────

create policy "miaa_rapports_tenant_select" on miaa_rapports
  for select using (
    tenant_id = (
      select p.tenant_id from profiles p
      where p.user_id = auth.uid()
      order by p.created_at asc limit 1
    )
  );

-- ── miaa_alertes ──────────────────────────────────────────────────

create policy "miaa_alertes_tenant_select" on miaa_alertes
  for select using (
    tenant_id = (
      select p.tenant_id from profiles p
      where p.user_id = auth.uid()
      order by p.created_at asc limit 1
    )
  );

create policy "miaa_alertes_tenant_update" on miaa_alertes
  for update using (
    tenant_id = (
      select p.tenant_id from profiles p
      where p.user_id = auth.uid()
      order by p.created_at asc limit 1
    )
  );

-- ================================================================
-- INDEXES — Performance (requêtes critiques)
-- ================================================================

-- miaa_memory : accès direct par tenant (1:1 donc unique déjà)
create index if not exists idx_miaa_memory_tenant
  on miaa_memory (tenant_id);

create index if not exists idx_miaa_memory_updated
  on miaa_memory (updated_at desc);

-- miaa_notifications : accès non-lues par tenant (hot path)
create index if not exists idx_miaa_notif_tenant_unread
  on miaa_notifications (tenant_id, lu, created_at desc);

create index if not exists idx_miaa_notif_priority
  on miaa_notifications (tenant_id, priority)
  where lu = false;

-- miaa_rapports : listing par tenant + type
create index if not exists idx_miaa_rapports_tenant
  on miaa_rapports (tenant_id, created_at desc);

create index if not exists idx_miaa_rapports_type
  on miaa_rapports (tenant_id, type, created_at desc);

-- miaa_alertes : alertes non-lues récentes
create index if not exists idx_miaa_alertes_tenant_unread
  on miaa_alertes (tenant_id, lu, created_at desc);

-- ================================================================
-- VUES — Reporting admin & monitoring
-- ================================================================

create or replace view miaa_memory_overview as
  select
    m.tenant_id,
    t.nom_entreprise,
    t.secteur_activite,
    m.nb_conversations,
    length(m.historique_resume)                       as taille_historique_chars,
    jsonb_array_length(m.patterns->'questions_frequentes') as nb_questions_apprises,
    jsonb_array_length(m.patterns->'problemes_recurrents') as nb_problemes_identifies,
    m.derniere_analyse,
    m.updated_at
  from miaa_memory m
  left join tenants t on t.id = m.tenant_id;

comment on view miaa_memory_overview is 'Vue admin : état de la mémoire MIAA+ par entreprise';

create or replace view miaa_notifications_summary as
  select
    tenant_id,
    count(*)                                      as nb_total,
    count(*) filter (where lu = false)            as nb_non_lues,
    count(*) filter (where priority = 'critical'
                     and lu = false)              as nb_critiques,
    max(created_at)                               as derniere_notif
  from miaa_notifications
  group by tenant_id;

comment on view miaa_notifications_summary is 'Vue admin : résumé notifications par tenant';

create or replace view miaa_rapports_summary as
  select
    tenant_id,
    type,
    count(*)        as nb_rapports,
    max(created_at) as dernier_rapport,
    sum(coalesce(tokens_used, 0)) as total_tokens
  from miaa_rapports
  group by tenant_id, type;

comment on view miaa_rapports_summary is 'Vue admin : résumé rapports générés par tenant + type';
