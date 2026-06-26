import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/resto/direction?mois=&annee=
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url   = new URL(req.url)
  const today = new Date().toISOString().split('T')[0]
  const annee = Number(url.searchParams.get('annee') ?? new Date().getFullYear())
  const mois  = Number(url.searchParams.get('mois')  ?? new Date().getMonth() + 1)
  const dDebut = `${annee}-${String(mois).padStart(2, '0')}-01`
  const dFin   = new Date(annee, mois, 0).toISOString().split('T')[0]
  const lundi  = new Date()
  lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7))
  const debutSemaine = lundi.toISOString().split('T')[0]
  const tenantId = ctx.tenantId

  const [
    { data: txToday },
    { data: txSemaine },
    { data: txMois },
    { data: txAchats },
    { data: tousStocks },
    { data: resasAujourd },
    { data: plats },
    { data: cmdMoisAll },
  ] = await Promise.all([
    supabaseAdmin.from('accounting_events').select('montant_ttc')
      .eq('tenant_id', tenantId).eq('event_type', 'RES-001').eq('date_event', today),
    supabaseAdmin.from('accounting_events').select('montant_ttc')
      .eq('tenant_id', tenantId).eq('event_type', 'RES-001').gte('date_event', debutSemaine),
    supabaseAdmin.from('accounting_events').select('montant_ttc')
      .eq('tenant_id', tenantId).eq('event_type', 'RES-001')
      .gte('date_event', dDebut).lte('date_event', dFin),
    supabaseAdmin.from('accounting_events').select('montant_ttc')
      .eq('tenant_id', tenantId).eq('event_type', 'RES-002')
      .gte('date_event', dDebut).lte('date_event', dFin),
    supabaseAdmin.from('stock_articles').select('nom, quantite, seuil_alerte')
      .eq('tenant_id', tenantId).eq('categorie', 'cuisine'),
    supabaseAdmin.from('resto_reservations').select('statut')
      .eq('tenant_id', tenantId).eq('date_resa', today),
    supabaseAdmin.from('resto_menu').select('id, nom, prix, cout_production, categorie')
      .eq('tenant_id', tenantId).gt('cout_production', 0),
    supabaseAdmin.from('resto_commandes')
      .select('mode, mode_paiement, total')
      .eq('tenant_id', tenantId).neq('statut', 'annule')
      .gte('created_at', dDebut + 'T00:00:00').lte('created_at', dFin + 'T23:59:59'),
  ])

  const sum = (arr: { montant_ttc: number }[] | null) =>
    (arr ?? []).reduce((s, r) => s + (Number(r.montant_ttc) || 0), 0)
  const sumTotal = (arr: { total: number }[] | null) =>
    (arr ?? []).reduce((s, r) => s + (r.total ?? 0), 0)

  const caAujourd  = sum(txToday)
  const caSemaine  = sum(txSemaine)
  const caMois     = sum(txMois)
  const achatsMois = sum(txAchats)
  const all        = cmdMoisAll ?? []

  const byMode = {
    salle:     all.filter(c => c.mode === 'salle' || c.mode === 'sur_place').length,
    livraison: all.filter(c => c.mode === 'livraison').length,
    emporter:  all.filter(c => c.mode === 'emporter' || c.mode === 'a_emporter').length,
  }
  const byPaiement = {
    especes: sumTotal(all.filter(c => c.mode_paiement === 'especes')),
    airtel:  sumTotal(all.filter(c => c.mode_paiement === 'airtel')),
    mtn:     sumTotal(all.filter(c => c.mode_paiement === 'mtn')),
    carte:   sumTotal(all.filter(c => c.mode_paiement === 'carte')),
  }

  const critiques = (tousStocks ?? []).filter(s =>
    (s.seuil_alerte ?? 0) > 0 && (s.quantite ?? 0) < (s.seuil_alerte ?? 0)
  )

  const rentabilite = (plats ?? [])
    .map(p => ({
      nom: p.nom, categorie: p.categorie, prix: p.prix, cout: p.cout_production,
      marge:     p.prix - p.cout_production,
      marge_pct: p.prix > 0 ? Math.round((p.prix - p.cout_production) / p.prix * 100) : 0,
    }))
    .sort((a, b) => b.marge - a.marge)
    .slice(0, 10)

  const historique = await Promise.all(
    Array.from({ length: 6 }, async (_, i) => {
      const m = ((mois - 1 - i + 12) % 12) + 1
      const a = m > mois ? annee - 1 : annee
      const d1 = `${a}-${String(m).padStart(2, '0')}-01`
      const d2 = new Date(a, m, 0).toISOString().split('T')[0]
      const { data } = await supabaseAdmin.from('accounting_events').select('montant_ttc')
        .eq('tenant_id', tenantId).eq('event_type', 'RES-001')
        .gte('date_event', d1).lte('date_event', d2)
      return { mois: m, annee: a, ca: (data ?? []).reduce((s, r) => s + (Number(r.montant_ttc) || 0), 0) }
    })
  )

  return NextResponse.json({
    kpis: {
      ca_aujourd: caAujourd, ca_semaine: caSemaine, ca_mois: caMois,
      achats_mois: achatsMois, resultat_mois: caMois - achatsMois,
      ticket_moyen: all.length > 0 ? Math.round(caMois / all.length) : 0,
      nb_commandes_mois: all.length,
      reservations_aujourd: (resasAujourd ?? []).length,
      reservations_confirmees: (resasAujourd ?? []).filter(r => r.statut === 'confirmee').length,
      stocks_critiques: critiques.length,
    },
    by_mode: byMode,
    by_paiement: byPaiement,
    rentabilite,
    stocks_critiques: critiques.slice(0, 10),
    historique: historique.reverse(),
  })
}
