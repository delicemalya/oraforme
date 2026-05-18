-- ============================================================
-- Migration 042 — Trésorerie Core Tables
-- Tables: caisses, comptes_bancaires, caisse_operations
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Caisses (cash registers) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.caisses (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nom            text NOT NULL DEFAULT 'Caisse principale',
  numero_compte  text NOT NULL DEFAULT '571000',  -- OHADA: Caisse
  solde          numeric(15,2) NOT NULL DEFAULT 0,
  actif          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caisses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "caisses_tenant_all" ON public.caisses;
CREATE POLICY "caisses_tenant_all"
  ON public.caisses FOR ALL
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 2. Comptes bancaires ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comptes_bancaires (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  banque         text NOT NULL,
  intitule       text NOT NULL,
  numero_compte  text,
  solde          numeric(15,2) NOT NULL DEFAULT 0,
  actif          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comptes_bancaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comptes_bancaires_tenant_all" ON public.comptes_bancaires;
CREATE POLICY "comptes_bancaires_tenant_all"
  ON public.comptes_bancaires FOR ALL
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 3. Caisse opérations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.caisse_operations (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  caisse_id        uuid NOT NULL REFERENCES public.caisses(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN ('depense', 'approvisionnement')),
  montant          numeric(15,2) NOT NULL,
  motif            text,
  beneficiaire     text,
  compte_charge    text,    -- OHADA debit account
  compte_source    text,    -- OHADA credit account
  reference_piece  text,
  date             date NOT NULL DEFAULT CURRENT_DATE,
  cloture_date     date,    -- populated when the day is closed
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caisse_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "caisse_operations_tenant_all" ON public.caisse_operations;
CREATE POLICY "caisse_operations_tenant_all"
  ON public.caisse_operations FOR ALL
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 4. Trigger: keep caisses.solde in sync ───────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_caisse_solde()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'approvisionnement' THEN
      UPDATE public.caisses SET solde = solde + NEW.montant WHERE id = NEW.caisse_id;
    ELSE
      UPDATE public.caisses SET solde = solde - NEW.montant WHERE id = NEW.caisse_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'approvisionnement' THEN
      UPDATE public.caisses SET solde = solde - OLD.montant WHERE id = OLD.caisse_id;
    ELSE
      UPDATE public.caisses SET solde = solde + OLD.montant WHERE id = OLD.caisse_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_caisse_solde ON public.caisse_operations;
CREATE TRIGGER trg_sync_caisse_solde
  AFTER INSERT OR DELETE ON public.caisse_operations
  FOR EACH ROW EXECUTE FUNCTION fn_sync_caisse_solde();
