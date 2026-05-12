'use server'

import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { SECTOR_MODULES, MODULE_META } from '@/lib/modules'

const VALID_MODULE_KEYS = new Set(Object.keys(MODULE_META))

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function createTenantAndProfile(data: {
  nomEntreprise:   string
  nif:             string
  secteurActivite: string
  customModules?:  string[]   // modules sélectionnés par l'utilisateur
}) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return { error: 'Non authentifié' }

  // Idempotency: if user already has a profile, do not create a second tenant
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingProfile?.tenant_id) return { success: true, alreadyExists: true }

  // Validate & merge modules: use client selection if provided, else fall back to sector defaults
  // Server-side validation: only accept known MODULE_META keys (never arbitrary strings)
  let modules: string[]
  if (data.customModules && data.customModules.length > 0) {
    modules = data.customModules.filter(k => VALID_MODULE_KEYS.has(k))
    if (modules.length === 0) modules = SECTOR_MODULES[data.secteurActivite] ?? ['facturation', 'tresorerie']
  } else {
    modules = SECTOR_MODULES[data.secteurActivite] ?? ['facturation', 'tresorerie']
  }

  // ── Create tenant ──────────────────────────────────────────────────────────
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert({
      nom_entreprise:   data.nomEntreprise,
      nif:              data.nif || null,
      plan:             'starter',
      secteur_activite: data.secteurActivite,
      modules_actifs:   modules,
    })
    .select()
    .single()

  if (tenantErr || !tenant) {
    console.error('[onboarding] tenant error:', tenantErr)
    return { error: `Erreur tenant : ${tenantErr?.message ?? 'inconnue'}` }
  }

  // ── Create profile ─────────────────────────────────────────────────────────
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .insert({
      tenant_id: tenant.id,
      user_id:   user.id,
      role:      'owner',
      nom:       data.nomEntreprise,
      prenom:    '',
    })

  if (profileErr) {
    console.error('[onboarding] profile error:', profileErr)
    return { error: `Erreur profil : ${profileErr.message}` }
  }

  // ── Populate tenant_modules (normalized) ───────────────────────────────────
  const { error: moduleErr } = await supabaseAdmin
    .from('tenant_modules')
    .insert(modules.map(key => ({ tenant_id: tenant.id, module_key: key, enabled: true })))

  if (moduleErr) {
    // Non-fatal: tenants.modules_actifs is the fallback
    console.error('[onboarding] tenant_modules error:', moduleErr)
  }

  return { success: true }
}
