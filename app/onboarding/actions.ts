'use server'

import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { buildTenantProfile } from '@/lib/tenant/TenantProfileFactory'
import type { TailleEntreprise, SecteurId } from '@/lib/plans'

export async function createTenantAndProfile(data: {
  nomEntreprise:   string
  niu?:            string
  telephone?:      string
  adresse?:        string
  secteurActivite: SecteurId | string
  sousType?:       string
  taille:          TailleEntreprise
  pays:            string
  langue:          string
  prenom:          string
  nom:             string
}) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return { error: 'Non authentifié' }

  // ── Server-side validation ────────────────────────────────────────────────────
  const VALID_TAILLES = new Set<string>(['tpe', 'pme', 'grande'])
  if (!VALID_TAILLES.has(data.taille)) {
    return { error: 'Plan invalide.' }
  }

  const VALID_SECTEURS = new Set<string>([
    'commerce', 'restaurant', 'ecole', 'sante', 'btp',
    'transport', 'hotel', 'agriculture', 'pharmacie', 'banque',
    'ong', 'cabinet', 'boisson', 'petrole', 'supermarche',
    'boutique', 'assurance', 'recrutement', 'autre',
  ])
  if (!VALID_SECTEURS.has(data.secteurActivite as string)) {
    return { error: 'Secteur invalide.' }
  }
  // ── End validation ────────────────────────────────────────────────────────────

  // Idempotency: if user already has a profile, do not create a second tenant
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existingProfile?.tenant_id) return { success: true, alreadyExists: true }

  // ── Check for a pending team invitation ──────────────────────────────────────
  const { data: invite } = await supabaseAdmin
    .from('team_invites')
    .select('tenant_id, role')
    .eq('email', user.email ?? '')
    .eq('accepted', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (invite) {
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        tenant_id: invite.tenant_id,
        user_id:   user.id,
        role:      invite.role || 'membre',
        nom:       data.nom,
        prenom:    data.prenom,
      })

    if (!profileErr) {
      await supabaseAdmin
        .from('team_invites')
        .update({ accepted: true })
        .eq('email', user.email ?? '')
        .eq('accepted', false)

      return { success: true }
    }
  }

  // ── Build complete tenant profile (single source of truth) ───────────────────
  const profile = buildTenantProfile({
    nomEntreprise: data.nomEntreprise,
    taille:        data.taille,
    secteur:       data.secteurActivite,
    pays:          data.pays || 'CG',
    langue:        data.langue || 'fr',
    telephone:     data.telephone,
    adresse:       data.adresse,
    sousType:      data.sousType,
    niu:           data.niu,
  })

  // ── Create tenant — no field is NULL by construction ──────────────────────────
  const tenantInsert: Record<string, unknown> = {
    nom_entreprise:      data.nomEntreprise,
    niu:                 data.niu || null,
    plan:                profile.plan,
    secteur_activite:    data.secteurActivite,
    taille_entreprise:   profile.taille_entreprise,
    type_entite:         profile.type_entite,
    allow_consolidation: profile.allow_consolidation,
    code_groupe:         profile.code_groupe,
    niveau_hierarchie:   profile.niveau_hierarchie,
    sous_type:           data.sousType || null,
    pays:                data.pays || 'CG',
    langue:              data.langue || 'fr',
    profil_complet:      false,
    company_deadline:    new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  }

  if (data.telephone) tenantInsert.telephone = data.telephone
  if (data.adresse)   tenantInsert.adresse   = data.adresse

  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert(tenantInsert)
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
      nom:       data.nom,
      prenom:    data.prenom,
    })

  if (profileErr) {
    console.error('[onboarding] profile error:', profileErr)
    return { error: `Erreur profil : ${profileErr.message}` }
  }

  // ── Populate tenant_modules (source of truth for runtime access) ──────────────
  const { error: moduleErr } = await supabaseAdmin
    .from('tenant_modules')
    .insert(profile.modules.map(key => ({ tenant_id: tenant.id, module_key: key, enabled: true })))

  if (moduleErr) {
    console.error('[onboarding] tenant_modules error:', moduleErr)
    return { error: `Erreur initialisation modules : ${moduleErr.message}` }
  }

  return { success: true }
}
