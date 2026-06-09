import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function getHisKPIs(tenantId: string) {
  const today      = new Date().toISOString().split('T')[0]
  const firstMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    patientsR, consultsR, litsR, urgActivesR, urgAujourdR,
    sejoursR, factR, personnelR, medecinR, laboR, imgR, blocR,
  ] = await Promise.all([
    supabaseAdmin.from('clinique_patients').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('actif', true),
    supabaseAdmin.from('clinique_consultations').select('montant')
      .eq('tenant_id', tenantId).gte('date_consult', firstMonth),
    supabaseAdmin.from('his_lits').select('statut').eq('tenant_id', tenantId),
    supabaseAdmin.from('his_urgences').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).in('statut', ['en_attente','triage_fait','en_soins']),
    supabaseAdmin.from('his_urgences').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('heure_arrivee', `${today}T00:00:00`),
    supabaseAdmin.from('his_sejours').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('statut', 'en_cours'),
    supabaseAdmin.from('his_factures').select('montant_total, montant_paye')
      .eq('tenant_id', tenantId).in('statut', ['en_attente','partielle']),
    supabaseAdmin.from('his_personnel').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('actif', true),
    supabaseAdmin.from('clinique_medecins').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('actif', true),
    supabaseAdmin.from('his_examens_labo').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).in('statut', ['prescrit','en_cours']),
    supabaseAdmin.from('his_examens_imagerie').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).in('statut', ['prescrit','planifie']),
    supabaseAdmin.from('his_interventions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('statut', 'programme')
      .gte('date_prevue', `${today}T00:00:00`).lt('date_prevue', `${today}T23:59:59.999Z`),
  ])

  const lits         = litsR.data ?? []
  const lits_total   = lits.length
  const lits_occupes = lits.filter(l => l.statut === 'occupe').length
  const taux_occ     = lits_total > 0 ? Math.round(lits_occupes / lits_total * 100) : 0

  const consults            = consultsR.data ?? []
  const ca_consultations    = consults.reduce((s, c) => s + (Number(c.montant) || 0), 0)
  const factures_imp        = factR.data ?? []
  const montant_impaye      = factures_imp.reduce((s, f) => s + Math.max(0, Number(f.montant_total) - Number(f.montant_paye)), 0)

  return {
    patients_actifs:      patientsR.count  ?? 0,
    consultations_mois:   consults.length,
    ca_consultations_mois: ca_consultations,
    lits_total,
    lits_occupes,
    taux_occupation:      taux_occ,
    urgences_actives:     urgActivesR.count ?? 0,
    urgences_aujourd:     urgAujourdR.count ?? 0,
    sejours_en_cours:     sejoursR.count   ?? 0,
    factures_impayees:    montant_impaye,
    personnel_total:      personnelR.count ?? 0,
    medecins_actifs:      medecinR.count   ?? 0,
    labo_en_attente:      laboR.count      ?? 0,
    imagerie_en_attente:  imgR.count       ?? 0,
    bloc_aujourd:         blocR.count      ?? 0,
  }
}

export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const kpis = await getHisKPIs(ctx.tenantId)

  // Monthly CA history (6 months)
  const historique = []
  for (let i = 5; i >= 0; i--) {
    const d    = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const from = d.toISOString().split('T')[0]
    d.setMonth(d.getMonth() + 1)
    const to   = d.toISOString().split('T')[0]

    const [cR, fR] = await Promise.all([
      supabaseAdmin.from('clinique_consultations').select('montant')
        .eq('tenant_id', ctx.tenantId).gte('date_consult', from).lt('date_consult', to),
      supabaseAdmin.from('his_factures').select('montant_paye')
        .eq('tenant_id', ctx.tenantId).in('statut', ['payee','partielle'])
        .gte('date_facture', from).lt('date_facture', to),
    ])
    const ca_consults = (cR.data ?? []).reduce((s, c) => s + (Number(c.montant) || 0), 0)
    const ca_factures = (fR.data ?? []).reduce((s, f) => s + (Number(f.montant_paye) || 0), 0)
    historique.push({
      mois:  new Date(from).toLocaleString('fr-FR', { month: 'short', year: '2-digit' }),
      ca:    ca_consults + ca_factures,
    })
  }

  return NextResponse.json({ kpis, historique })
}
