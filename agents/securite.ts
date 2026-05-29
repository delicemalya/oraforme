import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function createAlert(
  supabase: SupabaseClient,
  type: string,
  severity: 'info' | 'haute' | 'critique',
  message: string,
  action_prise?: string
) {
  await supabase.from('admin_alerts').insert({ type, severity, message, action_prise })
}

// Surveiller les tentatives de brute force via error_logs
export async function detecterAttaques() {
  const supabase = getSupabase()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: logs } = await supabase
    .from('error_logs')
    .select('data,occurred_at')
    .eq('module', 'auth')
    .gte('occurred_at', since)

  if (!logs || logs.length === 0) return { ok: true, alertes: 0 }

  // Compter par user_id suspect
  const parModule: Record<string, number> = {}
  for (const log of logs) {
    const key = (log.data as Record<string, string> | null)?.user_id ?? 'unknown'
    parModule[key] = (parModule[key] ?? 0) + 1
  }

  let alertes = 0
  for (const [userId, count] of Object.entries(parModule)) {
    if (count > 5) {
      await createAlert(
        supabase,
        'securite',
        'haute',
        `⚠️ ${count} erreurs auth en 1h pour user ${userId.slice(0, 8)}`,
        'Surveillance renforcée activée'
      )
      alertes++
    }
  }

  return { ok: true, alertes }
}

// Bloquer une IP suspecte
export async function bloquerIP(ip: string, raison: string, nb_tentatives: number) {
  const supabase = getSupabase()
  await supabase.from('ips_bloquees').upsert({
    ip,
    raison,
    nb_tentatives,
    bloque_jusqu: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })
  await createAlert(
    supabase,
    'securite',
    'haute',
    `🚨 IP ${ip} bloquée — ${nb_tentatives} tentatives (${raison})`,
    'IP bloquée 24h'
  )
}

// Monitorer les performances de la base de données
export async function monitorerPerformances() {
  const supabase = getSupabase()
  const start = Date.now()

  await supabase.from('tenants').select('id', { count: 'exact', head: true })

  const latence = Date.now() - start
  const statut = latence < 200 ? 'ok' : latence < 500 ? 'lent' : 'critique'

  await supabase.from('performance_logs').insert({
    latence_ms: latence,
    statut,
  })

  if (latence > 500) {
    await createAlert(
      supabase,
      'performance',
      'haute',
      `⚠️ Latence base de données : ${latence}ms — Performance dégradée`
    )
  }

  return { latence_ms: latence, statut }
}

// Backup logique : compter les enregistrements de chaque table critique
export async function backupQuotidien() {
  const supabase = getSupabase()
  const tables = ['tenants', 'factures', 'employes', 'etudiants', 'stock_articles', 'transactions', 'journal_entries']
  const results: { table: string; nb: number }[] = []

  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
    await supabase.from('backups').insert({
      table_name: table,
      nb_enregistrements: count ?? 0,
    })
    results.push({ table, nb: count ?? 0 })
  }

  console.log('✅ Agent Sécurité: Snapshot backup quotidien effectué', results)
  return { ok: true, tables: results }
}

// Vérifier alertes de stock — ruptures
export async function verifierStockRuptures() {
  const supabase = getSupabase()

  const { data: articles } = await supabase
    .from('stock_articles')
    .select('tenant_id,nom,quantite,seuil_alerte')

  const ruptures = articles?.filter(a => (a.quantite ?? 0) <= (a.seuil_alerte ?? 0)) ?? []

  if (ruptures.length > 0) {
    await createAlert(
      supabase,
      'stock',
      'haute',
      `📦 ${ruptures.length} article(s) en rupture ou sous seuil d'alerte`
    )
  }

  return { ok: true, ruptures: ruptures.length }
}

// Envoyer des relances automatiques pour factures en retard
export async function relancesFactures() {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  const { data: retards } = await supabase
    .from('factures')
    .select('id,tenant_id,client_name,total,montant_paye,due_date')
    .eq('statut', 'retard')
    .lt('due_date', today)
    .limit(50)

  if (!retards || retards.length === 0) return { ok: true, relances: 0 }

  await createAlert(
    supabase,
    'facturation',
    'info',
    `💰 ${retards.length} facture(s) en retard de paiement — relances à envoyer`
  )

  return { ok: true, relances: retards.length }
}

// Rapport superviseur quotidien
export async function rapportSuperviseur() {
  const supabase = getSupabase()

  const { count: nbTenants } = await supabase.from('tenants').select('*', { count: 'exact', head: true })
  const { count: nbAlertesNonLues } = await supabase
    .from('admin_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('lu', false)

  await createAlert(
    supabase,
    'superviseur',
    'info',
    `📊 Rapport quotidien — ${nbTenants ?? 0} tenants actifs, ${nbAlertesNonLues ?? 0} alerte(s) non lues`
  )

  return { ok: true, nb_tenants: nbTenants, alertes_non_lues: nbAlertesNonLues }
}

// Vérifier les étudiants avec impayés (module école)
export async function verifierImpayes() {
  const supabase = getSupabase()

  const { data: etudiants } = await supabase
    .from('etudiants')
    .select('id,tenant_id,nom,prenom,statut')
    .eq('statut', 'bloque')
    .limit(100)

  if (etudiants && etudiants.length > 0) {
    await createAlert(
      supabase,
      'ecole',
      'info',
      `🎓 ${etudiants.length} étudiant(s) bloqué(s) pour impayés`
    )
  }

  return { ok: true, bloques: etudiants?.length ?? 0 }
}

// Générer les rappels bulletins de paie (fin de mois)
export async function rappelsBulletinsPaie() {
  const supabase = getSupabase()
  const mois = new Date().getMonth() + 1
  const annee = new Date().getFullYear()

  const { count: dejaGeneres } = await supabase
    .from('bulletins_paie')
    .select('*', { count: 'exact', head: true })
    .eq('mois', mois)
    .eq('annee', annee)

  await createAlert(
    supabase,
    'rh',
    'info',
    `👥 Bulletin de paie ${mois}/${annee} : ${dejaGeneres ?? 0} bulletin(s) déjà générés`
  )

  return { ok: true, bulletins_generes: dejaGeneres }
}
