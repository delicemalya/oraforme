import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerPaie, SMIG_MENSUEL } from '@/lib/paie/calcul-paie'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agents/rh/analyse
 * Analyse RH proactive : détection anomalies, risques, KPIs clés.
 * Retourne un rapport structuré que MIAA injecte dans son contexte.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const now   = new Date()
  const mois  = now.getMonth() + 1
  const annee = now.getFullYear()

  // ── 1. Données employés ──────────────────────────────────────────────────
  const { data: employes } = await supabaseAdmin
    .from('employes')
    .select('id, nom, poste, salaire_base, contrat, statut, date_fin_contrat, date_naissance, date_embauche, solde_conges, cnss')
    .eq('tenant_id', ctx.tid)
    .order('nom')

  const emp = employes ?? []
  const actifs = emp.filter(e => e.statut === 'actif')

  // ── 2. Bulletins du mois ─────────────────────────────────────────────────
  const { data: bulletinsMois } = await supabaseAdmin
    .from('bulletins_paie')
    .select('id, employe_id, brut, cnss_salarie, cnss_patronal, irpp, net, statut')
    .eq('tenant_id', ctx.tid)
    .eq('mois', mois)
    .eq('annee', annee)

  // ── 3. Congés en attente ─────────────────────────────────────────────────
  const { data: congesAttente } = await supabaseAdmin
    .from('conges')
    .select('id, employe_id, type_conge, date_debut, date_fin, nb_jours, employes(nom)')
    .eq('tenant_id', ctx.tid)
    .eq('statut', 'en_attente')
    .limit(20)

  // ── 4. Calculs masse salariale ───────────────────────────────────────────
  const masseBrute  = actifs.reduce((s, e) => s + e.salaire_base, 0)
  const masseCalc   = actifs.map(e => ({ ...e, calc: calculerPaie({ salaire_base: e.salaire_base }) }))
  const masseNette  = masseCalc.reduce((s, e) => s + e.calc.salaire_net, 0)
  const massePatron = masseCalc.reduce((s, e) => s + e.calc.cout_total_employeur - e.salaire_base, 0)
  const coutTotal   = masseBrute + massePatron
  const totalCNSS   = masseCalc.reduce((s, e) => s + e.calc.cnss_employe + e.calc.cnss_patronal, 0)
  const totalIRPP   = masseCalc.reduce((s, e) => s + e.calc.irpp, 0)

  // ── 5. Détection anomalies ───────────────────────────────────────────────
  const anomalies: { type: string; gravite: 'critique' | 'haute' | 'moyenne'; employe?: string; detail: string }[] = []

  for (const e of actifs) {
    // Sous SMIG
    if (e.salaire_base < SMIG_MENSUEL) {
      anomalies.push({
        type: 'smig',
        gravite: 'critique',
        employe: e.nom,
        detail: `${e.nom} — salaire ${e.salaire_base.toLocaleString('fr-FR')} FCFA < SMIG légal ${SMIG_MENSUEL.toLocaleString('fr-FR')} FCFA (infraction Code Travail)`,
      })
    }

    // Contrat expiré
    if (e.date_fin_contrat) {
      const jours = Math.ceil((new Date(e.date_fin_contrat).getTime() - now.getTime()) / 86400000)
      if (jours < 0) {
        anomalies.push({
          type: 'contrat_expire',
          gravite: 'critique',
          employe: e.nom,
          detail: `${e.nom} — contrat ${e.contrat.toUpperCase()} expiré depuis ${Math.abs(jours)} jours. Risque requalification en CDI (art. 50 Code Travail).`,
        })
      } else if (jours <= 30) {
        anomalies.push({
          type: 'contrat_expire_proche',
          gravite: 'haute',
          employe: e.nom,
          detail: `${e.nom} — contrat ${e.contrat.toUpperCase()} expire dans ${jours} jours. Décision de renouvellement requise.`,
        })
      }
    }

    // Retraite imminente
    if (e.date_naissance) {
      const age = Math.floor((now.getTime() - new Date(e.date_naissance).getTime()) / (365.25 * 86400000))
      if (age >= 59 && e.statut === 'actif') {
        anomalies.push({
          type: 'retraite',
          gravite: 'moyenne',
          employe: e.nom,
          detail: `${e.nom} — ${age} ans. Planifier la transmission et le dossier de retraite CNSS.`,
        })
      }
    }

    // Solde congés élevé
    const solde = e.solde_conges ?? 26
    if (solde > 50) {
      anomalies.push({
        type: 'conges_accumules',
        gravite: 'moyenne',
        employe: e.nom,
        detail: `${e.nom} — ${solde} jours de congés non pris. Risque provision importante et épuisement.`,
      })
    }

    // Pas de numéro CNSS
    if (!e.cnss && e.contrat !== 'stage' && e.contrat !== 'freelance') {
      anomalies.push({
        type: 'cnss_manquant',
        gravite: 'haute',
        employe: e.nom,
        detail: `${e.nom} — numéro CNSS non renseigné. Obligation légale de déclaration à la CNSS.`,
      })
    }
  }

  // Bulletins non générés ce mois
  const idsAvecBulletin = new Set((bulletinsMois ?? []).map(b => b.employe_id))
  const sansB = actifs.filter(e => !idsAvecBulletin.has(e.id))
  if (sansB.length > 0) {
    anomalies.push({
      type: 'bulletins_manquants',
      gravite: 'haute',
      detail: `${sansB.length} employé(s) actif(s) sans bulletin pour ${['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][mois-1]} ${annee} : ${sansB.slice(0, 5).map(e => e.nom).join(', ')}${sansB.length > 5 ? `... (+${sansB.length - 5})` : ''}`,
    })
  }

  // ── 6. KPIs paie du mois ────────────────────────────────────────────────
  const buls        = bulletinsMois ?? []
  const brut_mois   = buls.reduce((s, b) => s + (b.brut ?? 0), 0)
  const cnss_mois   = buls.reduce((s, b) => s + (b.cnss_salarie ?? 0) + (b.cnss_patronal ?? 0), 0)
  const irpp_mois   = buls.reduce((s, b) => s + (b.irpp ?? 0), 0)
  const net_mois    = buls.reduce((s, b) => s + (b.net ?? 0), 0)

  // ── 7. Répartition par contrat ───────────────────────────────────────────
  const parContrat: Record<string, number> = {}
  for (const e of emp) {
    parContrat[e.contrat] = (parContrat[e.contrat] ?? 0) + 1
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    periode: { mois, annee },

    effectifs: {
      total:    emp.length,
      actifs:   actifs.length,
      conge:    emp.filter(e => e.statut === 'conge').length,
      malade:   emp.filter(e => e.statut === 'malade').length,
      licencie: emp.filter(e => e.statut === 'licencie').length,
    },

    masse_salariale: {
      brute:       masseBrute,
      nette:       masseNette,
      charges_patronales: massePatron,
      cout_total_employeur: coutTotal,
      cnss_a_declarer: totalCNSS,
      irpp_a_reverser: totalIRPP,
    },

    paie_mois: {
      nb_bulletins:    buls.length,
      bulletins_paye:  buls.filter(b => b.statut === 'payee').length,
      bulletins_valide:buls.filter(b => b.statut === 'validee').length,
      bulletins_genere:buls.filter(b => b.statut === 'generee').length,
      brut_total:      brut_mois,
      cnss_total:      cnss_mois,
      irpp_total:      irpp_mois,
      net_total:       net_mois,
      employes_sans_bulletin: sansB.length,
    },

    conges_en_attente: (congesAttente ?? []).length,

    repartition_contrats: parContrat,

    anomalies: anomalies.sort((a, b) => {
      const p = { critique: 0, haute: 1, moyenne: 2 }
      return p[a.gravite] - p[b.gravite]
    }),

    score_conformite: Math.max(0, 100 - (anomalies.filter(a => a.gravite === 'critique').length * 20) - (anomalies.filter(a => a.gravite === 'haute').length * 8) - (anomalies.filter(a => a.gravite === 'moyenne').length * 3)),
  })
}
