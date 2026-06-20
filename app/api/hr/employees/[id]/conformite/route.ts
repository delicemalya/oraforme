import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../../_auth'
import { getCountryConfig } from '@/lib/countries'
import { calculerIRPP, calculerChargesSociales } from '@/lib/fiscal/universal-tax-engine'
import type { CodePays } from '@/lib/countries/types'

export const runtime = 'nodejs'

interface ScoreItem {
  label:   string
  points:  number
  max:     number
  ok:      boolean
  detail?: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  const { data: emp, error } = await supabaseAdmin
    .from('employes')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .single()

  if (error || !emp) return NextResponse.json({ error: 'Employé non trouvé' }, { status: 404 })

  const codePays = (emp.pays_fiscal || emp.pays || 'CG') as CodePays
  const cfg      = getCountryConfig(codePays)
  const smig     = { montant: cfg.smig }

  const items: ScoreItem[] = []

  // 1. Salaire vs SMIG (20 pts)
  const smigOk = emp.salaire_base >= smig.montant
  items.push({
    label:  `Salaire ≥ SMIG (${smig.montant.toLocaleString('fr-FR')} ${cfg.devise})`,
    points: smigOk ? 20 : 0,
    max:    20,
    ok:     smigOk,
    detail: smigOk
      ? `${emp.salaire_base.toLocaleString('fr-FR')} ${cfg.devise} ≥ SMIG`
      : `${emp.salaire_base.toLocaleString('fr-FR')} < SMIG ${smig.montant.toLocaleString('fr-FR')} ${cfg.devise}`,
  })

  // 2. Convention / salaire conventionnel (20 pts)
  const convOk = emp.salaire_conventionnel
    ? emp.salaire_base >= emp.salaire_conventionnel
    : emp.code_secteur != null
  items.push({
    label:  'Salaire ≥ minimum conventionnel',
    points: convOk ? 20 : emp.code_secteur ? 8 : 0,
    max:    20,
    ok:     convOk,
    detail: emp.salaire_conventionnel
      ? (convOk ? 'Conforme convention' : `Déficit ${(emp.salaire_conventionnel - emp.salaire_base).toLocaleString('fr-FR')} ${cfg.devise}`)
      : 'Convention non renseignée',
  })

  // 3. CNSS renseigné (15 pts)
  const cnssOk = !!(emp.numero_cnss || emp.cnss)
  items.push({
    label:  `Numéro ${cfg.cnss.acronyme} renseigné`,
    points: cnssOk ? 15 : 0,
    max:    15,
    ok:     cnssOk,
  })

  // 4. Contrat complet (15 pts)
  const contratScore =
    (emp.contrat ? 5 : 0) +
    (emp.date_debut_contrat || emp.date_embauche ? 5 : 0) +
    (emp.periode_essai != null ? 5 : 0)
  items.push({
    label:  'Contrat complet (type + date + période essai)',
    points: contratScore,
    max:    15,
    ok:     contratScore === 15,
  })

  // 5. Coordonnées complètes (10 pts)
  const coordsScore =
    (emp.telephone ? 3 : 0) +
    (emp.adresse   ? 3 : 0) +
    ((emp.email || emp.email_pro) ? 4 : 0)
  items.push({
    label:  'Coordonnées complètes (téléphone, adresse, email)',
    points: coordsScore,
    max:    10,
    ok:     coordsScore >= 8,
  })

  // 6. Numéro fiscal renseigné (10 pts)
  const fiscalOk = !!emp.numero_fiscal
  items.push({
    label:  'Numéro fiscal renseigné',
    points: fiscalOk ? 10 : 0,
    max:    10,
    ok:     fiscalOk,
  })

  // 7. Données de paiement (10 pts)
  const paiementOk = !!(emp.banque || emp.rib || emp.iban || emp.mobile_money_numero)
  items.push({
    label:  'Mode de paiement configuré',
    points: paiementOk ? 10 : 0,
    max:    10,
    ok:     paiementOk,
  })

  const score  = items.reduce((s, i) => s + i.points, 0)
  const niveau = score >= 80 ? 'vert' : score >= 50 ? 'orange' : 'rouge'

  const alertes: string[] = []
  const recommandations: string[] = []

  if (!smigOk) {
    alertes.push(`Salaire inférieur au SMIG ${cfg.nom_pays} — risque légal`)
    recommandations.push(`Augmenter le salaire à ${smig.montant.toLocaleString('fr-FR')} ${cfg.devise} minimum`)
  }
  if (!cnssOk) {
    alertes.push(`Numéro ${cfg.cnss.acronyme} manquant — employé non déclaré`)
    recommandations.push(`Enregistrer l'employé auprès de ${cfg.cnss.nom}`)
  }
  if (!fiscalOk) {
    alertes.push('Numéro fiscal manquant — retenues IRPP impossibles')
    recommandations.push('Obtenir le numéro fiscal auprès de l\'administration fiscale')
  }
  if (!paiementOk) {
    alertes.push('Aucun mode de paiement configuré')
    recommandations.push('Renseigner les coordonnées bancaires ou mobile money')
  }

  // Calcul indicatif IRPP + CNSS
  let irpp_mensuel = 0
  let cnss_salarie = 0
  let cnss_patronal = 0
  try {
    const resIRPP = calculerIRPP({
      codePays,
      salaireBrut:   emp.salaire_base,
      situation:     emp.situation_matrimoniale === 'marie' ? 'marie' : 'celibataire',
      nombreEnfants: emp.nb_enfants ?? 0,
    })
    irpp_mensuel = resIRPP.irpp_net

    const resCNSS = calculerChargesSociales({ codePays, salaireBrut: emp.salaire_base })
    cnss_salarie  = resCNSS.total_salarie
    cnss_patronal = resCNSS.total_patronal_net
  } catch { /* engines may not have full data for all countries yet */ }

  return NextResponse.json({
    score,
    niveau,
    items,
    alertes,
    recommandations,
    calculs: {
      codePays,
      devise:       cfg.devise,
      smig:         smig.montant,
      irpp_mensuel,
      cnss_salarie,
      cnss_patronal,
      cout_employeur: emp.salaire_base + cnss_patronal,
    },
  })
}
