'use server'

import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface ProfilCompletionData {
  // Entreprise
  logo_url?:            string
  adresse?:             string
  ville?:               string
  telephone?:           string
  email_contact?:       string
  site_web?:            string
  niu?:                 string
  rccm?:                string
  numero_fiscal?:       string
  mobile_money?:        string
  // Dirigeant
  dirigeant_nom?:       string
  dirigeant_fonction?:  string
  dirigeant_telephone?: string
  dirigeant_email?:     string
  dirigeant_photo_url?: string
  // Réseaux sociaux
  reseaux_sociaux?: {
    facebook?:  string
    linkedin?:  string
    twitter?:   string
    instagram?: string
    tiktok?:    string
  }
  // Documents (tableau de {type, url, nom})
  documents_legaux?: Array<{ type: string; url: string; nom: string; uploaded_at?: string }>
}

// Champs pris en compte pour le calcul du % de complétion
const COMPLETION_FIELDS = [
  'nom_entreprise', 'secteur_activite', 'pays',       // toujours remplis (base = 15%)
  'logo_url', 'adresse', 'ville', 'telephone',
  'email_contact', 'site_web', 'niu', 'rccm',
  'numero_fiscal', 'mobile_money',
  'dirigeant_nom', 'dirigeant_fonction', 'dirigeant_telephone',
  'dirigeant_email', 'dirigeant_photo_url',
  'reseaux_sociaux_non_vide',  // pseudo-champ calculé
  'documents_legaux_non_vide', // pseudo-champ calculé
] as const

function computePct(tenant: Record<string, unknown>): number {
  let score = 0
  const per = 100 / COMPLETION_FIELDS.length

  for (const f of COMPLETION_FIELDS) {
    if (f === 'reseaux_sociaux_non_vide') {
      const rs = tenant.reseaux_sociaux as Record<string, string> | null
      if (rs && Object.values(rs).some(v => v && v.trim())) score += per
    } else if (f === 'documents_legaux_non_vide') {
      const dl = tenant.documents_legaux as unknown[]
      if (dl && dl.length > 0) score += per
    } else {
      const v = tenant[f]
      if (v !== null && v !== undefined && String(v).trim() !== '') score += per
    }
  }

  return Math.round(Math.min(score, 100))
}

export async function saveProfilCompletion(data: ProfilCompletionData) {
  const { ctx, error } = await requireTenant()
  if (error) return { error: 'Non autorisé' }

  // Fetch current tenant to compute pct correctly
  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('tenants')
    .select('nom_entreprise, secteur_activite, pays, logo_url, adresse, ville, telephone, email_contact, site_web, niu, rccm, numero_fiscal, mobile_money, dirigeant_nom, dirigeant_fonction, dirigeant_telephone, dirigeant_email, dirigeant_photo_url, reseaux_sociaux, documents_legaux')
    .eq('id', ctx.tenantId)
    .single()

  if (fetchErr || !current) return { error: 'Entreprise introuvable' }

  // Merge new data into current
  const merged: Record<string, unknown> = {
    ...current,
    ...Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    ),
  }

  const pct = computePct(merged)
  const profilComplet = pct >= 100

  const updatePayload: Record<string, unknown> = {
    profil_complet: profilComplet,
  }

  // Map ProfilCompletionData fields to DB columns
  if (data.logo_url            !== undefined) updatePayload.logo_url            = data.logo_url
  if (data.adresse             !== undefined) updatePayload.adresse             = data.adresse
  if (data.ville               !== undefined) updatePayload.ville               = data.ville
  if (data.telephone           !== undefined) updatePayload.telephone           = data.telephone
  if (data.email_contact       !== undefined) updatePayload.email_contact       = data.email_contact
  if (data.site_web            !== undefined) updatePayload.site_web            = data.site_web
  if (data.niu                 !== undefined) updatePayload.niu                 = data.niu
  if (data.rccm                !== undefined) updatePayload.rccm                = data.rccm
  if (data.numero_fiscal       !== undefined) updatePayload.numero_fiscal       = data.numero_fiscal
  if (data.mobile_money        !== undefined) updatePayload.mobile_money        = data.mobile_money
  if (data.dirigeant_nom       !== undefined) updatePayload.dirigeant_nom       = data.dirigeant_nom
  if (data.dirigeant_fonction  !== undefined) updatePayload.dirigeant_fonction  = data.dirigeant_fonction
  if (data.dirigeant_telephone !== undefined) updatePayload.dirigeant_telephone = data.dirigeant_telephone
  if (data.dirigeant_email     !== undefined) updatePayload.dirigeant_email     = data.dirigeant_email
  if (data.dirigeant_photo_url !== undefined) updatePayload.dirigeant_photo_url = data.dirigeant_photo_url
  if (data.reseaux_sociaux     !== undefined) updatePayload.reseaux_sociaux     = data.reseaux_sociaux
  if (data.documents_legaux    !== undefined) updatePayload.documents_legaux    = data.documents_legaux

  const { error: updateErr } = await supabaseAdmin
    .from('tenants')
    .update(updatePayload)
    .eq('id', ctx.tenantId)

  if (updateErr) return { error: updateErr.message }

  return { success: true, pct }
}

export async function fetchProfilCompletion(): Promise<{
  data: (ProfilCompletionData & {
    nom_entreprise?: string
    secteur_activite?: string
    pays?: string
    pct: number
  }) | null
  error?: string
}> {
  const { ctx, error } = await requireTenant()
  if (error) return { data: null, error: 'Non autorisé' }

  const { data, error: fetchErr } = await supabaseAdmin
    .from('tenants')
    .select('nom_entreprise, secteur_activite, pays, logo_url, adresse, ville, telephone, email_contact, site_web, niu, rccm, numero_fiscal, mobile_money, dirigeant_nom, dirigeant_fonction, dirigeant_telephone, dirigeant_email, dirigeant_photo_url, reseaux_sociaux, documents_legaux')
    .eq('id', ctx.tenantId)
    .single()

  if (fetchErr || !data) return { data: null, error: 'Introuvable' }

  const pct = computePct(data as Record<string, unknown>)
  return { data: { ...(data as ProfilCompletionData & { nom_entreprise?: string; secteur_activite?: string; pays?: string }), pct } }
}
