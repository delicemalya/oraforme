-- ================================================================
-- 089_miaa_expertise.sql
-- MIAA+ Marketplace d'Expertise — Documents professionnels
-- ================================================================

create table if not exists expertise_documents (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references tenants(id) on delete cascade,
  categorie    text        not null,
  type_doc     text        not null,
  titre        text        not null,
  contenu      text        not null,
  pays         text        not null default 'Congo',
  secteur      text,
  tokens_used  int,
  meta         jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

comment on table expertise_documents is 'Documents professionnels générés par MIAA+ Expertise Marketplace';

alter table expertise_documents enable row level security;

create policy "expertise_select" on expertise_documents
  for select using (
    tenant_id = (select p.tenant_id from profiles p
      where p.user_id = auth.uid() order by p.created_at asc limit 1)
  );
create policy "expertise_insert" on expertise_documents
  for insert with check (
    tenant_id = (select p.tenant_id from profiles p
      where p.user_id = auth.uid() order by p.created_at asc limit 1)
  );

create index if not exists idx_expertise_tenant
  on expertise_documents (tenant_id, categorie, created_at desc);
create index if not exists idx_expertise_type
  on expertise_documents (tenant_id, type_doc);
