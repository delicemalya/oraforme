import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Cloture journalière restaurant — lancée chaque soir à 23h59
// Calcule le CA du jour, ferme les commandes ouvertes, crée l'entrée caisse
export async function GET() {
  const supabase = getSupabase()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00.000Z`
  const endOfDay = `${today}T23:59:59.999Z`

  try {
    // Récupérer les tenants actifs avec secteur restaurant
    const { data: tenants, error: tenantsErr } = await supabase
      .from('tenants')
      .select('id, nom_entreprise')
      .eq('secteur_activite', 'restaurant')
      .eq('status', 'active')

    if (tenantsErr) throw tenantsErr
    if (!tenants?.length) return NextResponse.json({ ok: true, clotured: 0, message: 'Aucun tenant restaurant actif' })

    let clotured = 0
    const resultats: Record<string, unknown>[] = []

    for (const tenant of tenants) {
      try {
        // CA du jour
        const { data: commandes } = await supabase
          .from('resto_commandes')
          .select('total, paiement, statut')
          .eq('tenant_id', tenant.id)
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay)
          .eq('statut', 'payee')

        const ca_total = (commandes ?? []).reduce((s, c) => s + (c.total ?? 0), 0)
        const nb_commandes = commandes?.length ?? 0

        // Ventilation par mode de paiement
        const par_paiement: Record<string, number> = {}
        for (const c of commandes ?? []) {
          const mode = c.paiement ?? 'especes'
          par_paiement[mode] = (par_paiement[mode] ?? 0) + (c.total ?? 0)
        }

        // Commandes non payées (oubliées / tables encore ouvertes)
        const { data: ouvertes } = await supabase
          .from('resto_commandes')
          .select('id, table_num, total')
          .eq('tenant_id', tenant.id)
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay)
          .in('statut', ['en_attente', 'en_preparation', 'prete'])

        // Alertes stock bas après service
        const { data: stockBas } = await supabase
          .from('articles')
          .select('nom, quantite, seuil_alerte')
          .eq('tenant_id', tenant.id)
          .eq('categorie', 'cuisine')
          .not('seuil_alerte', 'is', null)
          .lt('quantite', 5)

        // Créer une alerte de cloture
        if (ca_total > 0 || nb_commandes > 0) {
          await supabase.from('admin_alerts').insert({
            type: 'restaurant_cloture',
            severity: 'info',
            message: `🍽️ Clôture ${today} — ${tenant.nom_entreprise} : ${nb_commandes} commandes · CA ${Math.round(ca_total).toLocaleString('fr-FR')} FCFA`,
            action_prise: JSON.stringify({ ca_total, nb_commandes, par_paiement, tables_ouvertes: ouvertes?.length ?? 0 }),
          })
        }

        // Alerte si tables non fermées
        if ((ouvertes?.length ?? 0) > 0) {
          await supabase.from('admin_alerts').insert({
            type: 'restaurant_cloture',
            severity: 'haute',
            message: `⚠️ ${ouvertes!.length} table(s) non clôturée(s) chez ${tenant.nom_entreprise} — vérification requise`,
            action_prise: `Tables: ${ouvertes!.map(o => o.table_num ?? 'N/A').join(', ')}`,
          })
        }

        resultats.push({ tenant_id: tenant.id, nom: tenant.nom_entreprise, ca_total, nb_commandes, tables_ouvertes: ouvertes?.length ?? 0, stock_bas: stockBas?.length ?? 0 })
        clotured++
      } catch (err) {
        console.error(`[cloture] Erreur tenant ${tenant.id}:`, err)
        resultats.push({ tenant_id: tenant.id, nom: tenant.nom_entreprise, error: String(err) })
      }
    }

    return NextResponse.json({ ok: true, date: today, clotured, resultats })
  } catch (err) {
    console.error('[agent/restaurant/cloture]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
