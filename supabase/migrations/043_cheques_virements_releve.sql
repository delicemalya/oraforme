-- ============================================================
-- Migration 043 — Chèques, Virements, Relevés bancaires
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Chèques ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cheques (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  compte_bancaire_id  uuid REFERENCES public.comptes_bancaires(id) ON DELETE SET NULL,
  type                text NOT NULL CHECK (type IN ('emis', 'recu')),
  numero              text NOT NULL,
  montant             numeric(15,2) NOT NULL,
  beneficiaire        text,
  emetteur            text,
  banque_tiree        text,
  date_emission       date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance       date,
  date_encaissement   date,
  motif               text,
  statut              text NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente', 'encaisse', 'rejete', 'annule')),
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cheques_tenant_all" ON public.cheques;
CREATE POLICY "cheques_tenant_all" ON public.cheques FOR ALL
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 2. Virements ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.virements (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  compte_source_id    uuid REFERENCES public.comptes_bancaires(id) ON DELETE SET NULL,
  compte_source_label text,
  compte_dest_label   text NOT NULL,
  montant             numeric(15,2) NOT NULL,
  motif               text,
  date                date NOT NULL DEFAULT CURRENT_DATE,
  statut              text NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente', 'execute', 'rejete', 'annule')),
  reference           text,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.virements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "virements_tenant_all" ON public.virements;
CREATE POLICY "virements_tenant_all" ON public.virements FOR ALL
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 3. Lignes de relevé bancaire (import CSV) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.releve_lignes (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  compte_bancaire_id  uuid REFERENCES public.comptes_bancaires(id) ON DELETE SET NULL,
  date                date NOT NULL,
  libelle             text NOT NULL,
  montant             numeric(15,2) NOT NULL,
  type                text NOT NULL CHECK (type IN ('credit', 'debit')),
  reference           text,
  statut              text NOT NULL DEFAULT 'non_rapproche'
                        CHECK (statut IN ('non_rapproche', 'rapproche', 'ignore')),
  transaction_id      uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.releve_lignes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "releve_lignes_tenant_all" ON public.releve_lignes;
CREATE POLICY "releve_lignes_tenant_all" ON public.releve_lignes FOR ALL
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());
