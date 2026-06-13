/**
 * POST /api/miaa/analyse-quotidienne
 *
 * Analyse quotidienne complète d'un tenant par MIAA+.
 * Appelé chaque matin par le cron (06:00 UTC) pour chaque tenant actif.
 * Détecte anomalies, risques, échéances, impayés, stocks critiques.
 * Génère des propositions structurées et sauvegarde le rapport.
 *
 * Header : Authorization: Bearer <CRON_SECRET>
 * Body   : { tenant_id: string }
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { chargerMemoireMIAA } from '@/lib/miaa/memory'
import { runAgentAnalysis } from '@/lib/miaa/autonomous-engine'

export const runtime  = 'nodejs'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

// ── Analyses métier ──────────────────────────────────────────────────────────

async function analyserFactures(supabase: ReturnType<typeof db>, tenantId: string) {
  const { data } = await supabase
    .from('factures')
    .select('id,numero,montant_ttc,statut,client_nom,echeance,created_at')
    .eq('tenant_id', tenantId)
    .in('statut', ['envoyee', 'partiellement_payee'])
    .order('echeance', { ascending: true })
    .limit(50)

  if (!data?.length) return { impayees: 0, montant_total: 0, en_retard: 0, alertes: [] }

  const now = new Date()
  const en_retard = data.filter(f => f.echeance && new Date(f.echeance) < now)
  const montant_total = data.reduce((s, f) => s + (f.montant_ttc ?? 0), 0)

  const alertes: string[] = []
  if (en_retard.length > 0)
    alertes.push(`${en_retard.length} facture(s) en retard — ${fmt(en_retard.reduce((s, f) => s + (f.montant_ttc ?? 0), 0))} FCFA`)
  if (data.length > 10)
    alertes.push(`${data.length} factures impayées au total — ${fmt(montant_total)} FCFA`)

  return { impayees: data.length, montant_total, en_retard: en_retard.length, alertes }
}

async function analyserStock(supabase: ReturnType<typeof db>, tenantId: string) {
  const { data } = await supabase
    .from('articles')
    .select('id,nom,quantite,seuil_alerte,prix_unitaire')
    .eq('tenant_id', tenantId)
    .limit(200)

  if (!data?.length) return { ruptures: 0, alertes: [] }

  const ruptures = data.filter(a => a.seuil_alerte && a.quantite <= a.seuil_alerte)
  const alertes: string[] = []

  if (ruptures.length > 0)
    alertes.push(`${ruptures.length} article(s) en rupture ou sous seuil : ${ruptures.slice(0, 3).map(a => a.nom).join(', ')}${ruptures.length > 3 ? `… et ${ruptures.length - 3} autres` : ''}`)

  return { ruptures: ruptures.length, alertes }
}

async function analyserRH(supabase: ReturnType<typeof db>, tenantId: string) {
  const today = new Date()
  const moisCourant = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const alertes: string[] = []

  const { data: employes } = await supabase
    .from('employes')
    .select('id,nom,prenom,statut')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif')
    .limit(200)

  const nbEmployes = employes?.length ?? 0

  // Vérifier si les bulletins du mois courant ont été générés
  const { data: bulletins, count: bulletinCount } = await supabase
    .from('bulletins_paie')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .gte('created_at', `${moisCourant}-01`)
    .limit(1)

  if (nbEmployes > 0 && (bulletinCount ?? 0) === 0) {
    alertes.push(`${nbEmployes} employé(s) actif(s) — bulletins de paie du mois non générés`)
  }

  // Contrats expirant dans 30 jours
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30)
  const { data: contrats } = await supabase
    .from('employes')
    .select('id,nom,prenom,date_fin_contrat,type_contrat')
    .eq('tenant_id', tenantId)
    .eq('type_contrat', 'CDD')
    .gte('date_fin_contrat', today.toISOString().slice(0, 10))
    .lte('date_fin_contrat', in30.toISOString().slice(0, 10))
    .limit(20)

  if ((contrats?.length ?? 0) > 0) {
    alertes.push(`${contrats!.length} contrat(s) CDD expirant dans 30 jours : ${contrats!.slice(0, 3).map(e => `${e.prenom} ${e.nom}`).join(', ')}`)
  }

  return { nb_employes: nbEmployes, alertes }
}

async function analyserFiscalite(tenantId: string) {
  const today = new Date()
  const month = today.getMonth() + 1
  const day   = today.getDate()
  const alertes: string[] = []

  // TVA trimestrielle : due le 20 du mois après fin de trimestre (avril, juillet, octobre, janvier)
  const tvaMonths = [4, 7, 10, 1]
  if (tvaMonths.includes(month) && day >= 10 && day <= 20)
    alertes.push(`TVA trimestrielle due le 20/${String(month).padStart(2,'0')} — Vérifiez votre déclaration DGI`)

  // CNSS mensuelle : due le 15 de chaque mois
  if (day >= 10 && day <= 15)
    alertes.push(`CNSS mensuelle due le 15/${String(month).padStart(2,'0')} — Préparez votre déclaration`)

  // IS trimestriel : 15 avril, juillet, octobre
  const isMonths = [4, 7, 10]
  if (isMonths.includes(month) && day >= 10 && day <= 15)
    alertes.push(`Acompte IS 30% dû le 15/${String(month).padStart(2,'0')} — Calculez votre assiette`)

  // Patente annuelle : mars
  if (month === 3 && day >= 1 && day <= 31)
    alertes.push(`Patente annuelle à renouveler ce mois — Contactez votre receveur des impôts`)

  return alertes
}

async function analyserTresorerie(supabase: ReturnType<typeof db>, tenantId: string) {
  const { data: mvts } = await supabase
    .from('mouvements_tresorerie')
    .select('type,montant,created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
    .limit(500)

  const alertes: string[] = []
  if (!mvts?.length) return alertes

  const entrees  = mvts.filter(m => m.type === 'entree').reduce((s, m) => s + (m.montant ?? 0), 0)
  const sorties  = mvts.filter(m => m.type === 'sortie').reduce((s, m) => s + (m.montant ?? 0), 0)
  const solde    = entrees - sorties

  if (solde < 0)
    alertes.push(`Trésorerie nette négative sur 30 jours : ${fmt(solde)} FCFA — Action urgente requise`)
  else if (solde < 500_000)
    alertes.push(`Trésorerie faible : ${fmt(solde)} FCFA — Surveiller les encaissements`)

  return alertes
}

// ── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const secret     = process.env.CRON_SECRET ?? ''

  // Accepter appel interne (depuis cron) ou direct avec secret
  const isInternal = req.headers.get('x-internal') === 'true'
  if (!isInternal && secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tenant_id } = await req.json() as { tenant_id: string }
  if (!tenant_id) return Response.json({ error: 'tenant_id requis' }, { status: 400 })

  const supabase = db()

  try {
    // 1. Charger mémoire
    const memory = await chargerMemoireMIAA(supabase, tenant_id)

    // 2. Analyse moteur autonome (proposals structurées)
    const analyse = await runAgentAnalysis(supabase, tenant_id, memory)

    // 3. Analyses métier parallèles
    const [facturesRes, stockRes, rhRes, fiscalAlertes, tresoAlertes] = await Promise.all([
      analyserFactures(supabase, tenant_id),
      analyserStock(supabase, tenant_id),
      analyserRH(supabase, tenant_id),
      analyserFiscalite(tenant_id),
      analyserTresorerie(supabase, tenant_id),
    ])

    // 4. Consolider toutes les alertes
    const allAlertes = [
      ...facturesRes.alertes,
      ...stockRes.alertes,
      ...rhRes.alertes,
      ...fiscalAlertes,
      ...tresoAlertes,
    ]

    // 5. Claude génère un rapport narratif si alertes présentes
    let rapportTexte = ''
    if (allAlertes.length > 0) {
      const res = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: `Tu es MIAA+, directeur virtuel de l'entreprise ${memory.entreprise.nom} (${memory.entreprise.secteur}, ${memory.entreprise.pays}).
Génère un rapport quotidien concis, professionnel et bienveillant.
Format : texte structuré, sans markdown, sans astérisques.
Maximum 5 points essentiels. Termine par 2 recommandations prioritaires.`,
        messages: [{
          role: 'user',
          content: `Rapport du ${new Date().toLocaleDateString('fr-FR')} :\n\n${allAlertes.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nDonnées live : CA mois ${fmt(memory.donnees_live.ca_mois)} FCFA, ${memory.donnees_live.employes_actifs} employés, ${memory.donnees_live.factures_impayees} factures impayées.`,
        }],
      })
      rapportTexte = res.content[0].type === 'text' ? res.content[0].text : ''
    } else {
      rapportTexte = `Rapport du ${new Date().toLocaleDateString('fr-FR')} — Bonne nouvelle : aucune anomalie majeure détectée pour ${memory.entreprise.nom}. Continuez sur cette lancée !`
    }

    // 6. Sauvegarder le rapport quotidien
    await supabase.from('miaa_daily_reports').upsert({
      tenant_id,
      date_rapport:     new Date().toISOString().slice(0, 10),
      score_sante:      analyse.score_sante,
      nb_alertes:       allAlertes.length,
      nb_proposals:     analyse.proposals.length,
      modules_analyses: analyse.modules_analyses,
      rapport_json: {
        proposals:  analyse.proposals,
        alertes:    allAlertes,
        facturesRes, stockRes, rhRes,
        fiscal:     fiscalAlertes,
        tresorerie: tresoAlertes,
      },
      rapport_texte: rapportTexte,
    }, { onConflict: 'tenant_id,date_rapport' })

    // 7. Sauvegarder dans miaa_notifications (si alertes critiques)
    const critiques = analyse.proposals.filter(p => p.impact === 'critical' || p.impact === 'high')
    for (const p of critiques.slice(0, 5)) {
      await supabase.from('miaa_notifications').upsert({
        id:          `daily-${tenant_id}-${p.id}`,
        tenant_id,
        titre:       p.titre,
        message:     p.description,
        type:        p.module,
        priority:    p.impact,
        action_url:  p.action_href ?? null,
        action_label: p.action_label,
        lu:          false,
        created_at:  new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    return Response.json({
      ok:              true,
      tenant_id,
      score_sante:     analyse.score_sante,
      nb_alertes:      allAlertes.length,
      nb_proposals:    analyse.proposals.length,
      rapport_texte:   rapportTexte,
      timestamp:       new Date().toISOString(),
    })

  } catch (err) {
    console.error('[MIAA analyse-quotidienne]', err)
    return Response.json({ error: 'Erreur analyse', detail: String(err) }, { status: 500 })
  }
}
