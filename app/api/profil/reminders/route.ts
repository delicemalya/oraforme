/**
 * POST /api/profil/reminders
 *
 * Runner de rappels de complétion de profil — appelé par pg_cron ou manuellement.
 * Fenêtres : 72h (info), 48h (warning), 24h (critical), 0h (expired)
 *
 * Auth : service-key uniquement (x-automation-secret) OU superadmin session.
 * Body : { dry_run?: boolean }  — si true, retourne les candidats sans envoyer
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createWhatsappService } from '@/lib/whatsapp-business'
import { requireAutomationSecret } from '@/lib/api/require-automation'

// ── Fenêtres de rappel (en heures) ────────────────────────────────────────────
// On envoie quand le temps restant passe SOUS ce seuil ET n'a pas encore été envoyé.
const REMINDER_WINDOWS = [
  { key: 'r72', maxHours: 72, minHours: 49, label: '72h' },
  { key: 'r48', maxHours: 48, minHours: 25, label: '48h' },
  { key: 'r24', maxHours: 24, minHours:  0, label: '24h' },
  { key: 'r00', maxHours:  0, minHours: -Infinity, label: 'expired' },
]

interface TenantRow {
  id:               string
  nom_entreprise:   string
  company_deadline: string
  telephone:        string | null
  profil_reminders: Record<string, boolean> | null
}

interface ProfileRow {
  prenom:    string | null
  nom:       string | null
  telephone: string | null
}

export async function POST(req: NextRequest) {
  // ── Auth : secret d'automatisation (pg_cron, migration 167) ───────────────
  const denied = requireAutomationSecret(req)
  if (denied) return denied

  const body    = await req.json().catch(() => ({})) as { dry_run?: boolean }
  const dryRun  = body.dry_run === true
  const now     = new Date()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.oraforme.com'

  // ── Fetch tenants avec profil incomplet et deadline ───────────────────────
  const { data: tenants, error: fetchErr } = await supabaseAdmin
    .from('tenants')
    .select('id, nom_entreprise, company_deadline, telephone, profil_reminders')
    .eq('profil_complet', false)
    .not('company_deadline', 'is', null)

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const results: Array<{
    tenantId:    string
    company:     string
    window:      string
    hoursLeft:   number
    sent:        boolean
    skipped?:    string
  }> = []

  for (const tenant of (tenants ?? []) as TenantRow[]) {
    const deadlineMs  = new Date(tenant.company_deadline).getTime()
    const diffMs      = deadlineMs - now.getTime()
    const hoursLeft   = Math.floor(diffMs / (1000 * 60 * 60))

    // Trouver la fenêtre applicable
    const window = REMINDER_WINDOWS.find(w =>
      hoursLeft <= w.maxHours && hoursLeft >= w.minHours
    )
    if (!window) continue  // pas encore dans la fenêtre de rappel

    // Vérifier si ce rappel a déjà été envoyé
    const sent = (tenant.profil_reminders ?? {})[window.key] === true
    if (sent) {
      results.push({
        tenantId: tenant.id, company: tenant.nom_entreprise,
        window: window.label, hoursLeft, sent: false, skipped: 'already_sent',
      })
      continue
    }

    // Trouver le téléphone de l'owner
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('prenom, nom, telephone')
      .eq('tenant_id', tenant.id)
      .eq('role', 'owner')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle() as { data: ProfileRow | null }

    const phone = ownerProfile?.telephone ?? tenant.telephone
    if (!phone) {
      results.push({
        tenantId: tenant.id, company: tenant.nom_entreprise,
        window: window.label, hoursLeft, sent: false, skipped: 'no_phone',
      })
      continue
    }

    if (!dryRun) {
      // Envoyer via WhatsApp
      const wa     = createWhatsappService(tenant.id)
      const waRes  = await wa.sendProfilCompletionReminder({
        to:           phone,
        toName:       ownerProfile?.prenom ?? undefined,
        companyName:  tenant.nom_entreprise,
        hoursLeft:    Math.max(hoursLeft, 0),
        dashboardUrl: `${appUrl}/dashboard`,
      })

      if (waRes.ok) {
        // Marquer le rappel comme envoyé
        const updated = { ...(tenant.profil_reminders ?? {}), [window.key]: true }
        await supabaseAdmin
          .from('tenants')
          .update({ profil_reminders: updated })
          .eq('id', tenant.id)
      }

      results.push({
        tenantId: tenant.id, company: tenant.nom_entreprise,
        window: window.label, hoursLeft, sent: waRes.ok,
        skipped: waRes.ok ? undefined : waRes.error,
      })
    } else {
      // Dry run — juste lister sans envoyer
      results.push({
        tenantId: tenant.id, company: tenant.nom_entreprise,
        window: window.label, hoursLeft, sent: false, skipped: 'dry_run',
      })
    }
  }

  const sent    = results.filter(r => r.sent).length
  const skipped = results.filter(r => !r.sent).length

  return NextResponse.json({ ok: true, dryRun, total: results.length, sent, skipped, results })
}
