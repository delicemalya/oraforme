import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { redirect } from 'next/navigation'
import EcoleDashboardClient from './_lib/ecole-dashboard-client'

export type EcoleRole =
  | 'DIRECTION_GENERALE' | 'RAF' | 'SCOLARITE' | 'RH_PAIE'
  | 'FORMATEUR' | 'ETUDIANT' | 'PARENT' | 'DTI' | 'DAAC'

export type EcoleKpis = {
  // Shared (visible to all)
  nbEtudiants:     number
  nbActifs:        number
  nbEnseignants:   number
  nbAbsencesJour:  number
  nbExamensAvenir: number
  nbNotifs:        number
  // Financial (DIRECTION + RAF only)
  revenuMois:            number
  nbPaiementsEnAttente:  number
  montantImpayes:        number
  soldeTresorerie:       number
  // RH
  nbEmployes:      number
  nbHeurePending:  number
  // Formateur
  myHeuresTotales: number
  myHeuresValidees:number
  // Étudiant
  myNotesMoyenne:  number | null
  myAbsences:      number
  myPaiementOk:    boolean | null
}

export default async function EcoleDashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, tenant_id, dynamic_role_id, ecole_role_name, tenants(nom_entreprise, secteur_activite)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.tenant_id) redirect('/onboarding')

  const tid      = profile.tenant_id
  const tenantData = profile.tenants as unknown as { nom_entreprise: string } | null
  const nomEcole = tenantData?.nom_entreprise ?? 'Mon École'

  // ── Résoudre le rôle école ──────────────────────────────────────────────────
  let roleName: EcoleRole = 'SCOLARITE'

  if (profile.role === 'owner') {
    roleName = 'DIRECTION_GENERALE'
  } else if (profile.ecole_role_name) {
    roleName = profile.ecole_role_name as EcoleRole
  } else if (profile.dynamic_role_id) {
    const { data: rd } = await supabase
      .from('roles')
      .select('name')
      .eq('id', profile.dynamic_role_id)
      .maybeSingle()
    if (rd?.name) roleName = rd.name as EcoleRole
  }

  const isFinancial = ['DIRECTION_GENERALE', 'RAF'].includes(roleName) || profile.role === 'owner'

  const today        = new Date().toISOString().split('T')[0]
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0]

  // ── KPIs communs (tous les rôles) ────────────────────────────────────────────
  const [etuRes, actifRes, ensRes, absJourRes, examRes, notifRes] = await Promise.all([
    supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
    supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('statut', 'actif'),
    supabase.from('enseignants').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
    supabase.from('absences_etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('date_absence', today),
    supabase.from('exams').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('date_exam', today),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('read', false),
  ])

  // ── KPIs financiers ──────────────────────────────────────────────────────────
  let revenuMois           = 0
  let nbPaiementsEnAttente = 0
  let montantImpayes       = 0
  let soldeTresorerie      = 0

  if (isFinancial) {
    const [paiMoisRes, paiAttRes, trxRes] = await Promise.all([
      supabase.from('paiements_scolaires').select('montant').eq('tenant_id', tid).eq('statut', 'paye').gte('created_at', startOfMonth),
      supabase.from('paiements_scolaires').select('montant', { count: 'exact' }).eq('tenant_id', tid).eq('statut', 'en_attente'),
      supabase.from('transactions').select('type, montant').eq('tenant_id', tid).gte('date', startOfMonth),
    ])
    revenuMois           = paiMoisRes.data?.reduce((s, p) => s + (p.montant ?? 0), 0) ?? 0
    nbPaiementsEnAttente = paiAttRes.count ?? 0
    montantImpayes       = paiAttRes.data?.reduce((s, p) => s + (p.montant ?? 0), 0) ?? 0
    soldeTresorerie      = (trxRes.data ?? []).reduce((s, t) =>
      t.type === 'entree' ? s + t.montant : s - t.montant, 0)
  }

  // ── KPIs RH ──────────────────────────────────────────────────────────────────
  let nbEmployes     = 0
  let nbHeurePending = 0

  if (['DIRECTION_GENERALE', 'RAF', 'RH_PAIE'].includes(roleName)) {
    const [empRes, hRes] = await Promise.all([
      supabase.from('employes').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      supabase.from('teacher_hours').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('statut', 'declare'),
    ])
    nbEmployes     = empRes.count ?? 0
    nbHeurePending = hRes.count ?? 0
  }

  // ── KPIs Formateur ───────────────────────────────────────────────────────────
  let myHeuresTotales  = 0
  let myHeuresValidees = 0

  if (roleName === 'FORMATEUR') {
    const { data: ens } = await supabase
      .from('enseignants')
      .select('id')
      .eq('tenant_id', tid)
      .eq('email', user.email ?? '__none__')
      .maybeSingle()

    if (ens) {
      const { data: hrs } = await supabase
        .from('teacher_hours')
        .select('heures, statut')
        .eq('tenant_id', tid)
        .eq('enseignant_id', ens.id)
      myHeuresTotales  = hrs?.reduce((s, h) => s + (h.heures ?? 0), 0) ?? 0
      myHeuresValidees = hrs?.filter(h => h.statut !== 'declare').reduce((s, h) => s + (h.heures ?? 0), 0) ?? 0
    }
  }

  // ── KPIs Étudiant ────────────────────────────────────────────────────────────
  let myNotesMoyenne: number | null = null
  let myAbsences    = 0
  let myPaiementOk: boolean | null = null

  if (roleName === 'ETUDIANT') {
    const { data: etu } = await supabase
      .from('etudiants')
      .select('id')
      .eq('tenant_id', tid)
      .eq('user_id', user.id)
      .maybeSingle()

    if (etu) {
      const [notesRes, absRes, paiRes] = await Promise.all([
        supabase.from('notes_etudiants').select('note, note_max').eq('etudiant_id', etu.id),
        supabase.from('absences_etudiants').select('id', { count: 'exact', head: true }).eq('etudiant_id', etu.id),
        supabase.from('paiements_scolaires').select('statut').eq('etudiant_id', etu.id).order('created_at', { ascending: false }).limit(1),
      ])
      const notes = notesRes.data ?? []
      if (notes.length > 0) {
        myNotesMoyenne = notes.reduce((s, n) => s + (n.note / (n.note_max || 20)) * 20, 0) / notes.length
      }
      myAbsences   = absRes.count ?? 0
      myPaiementOk = paiRes.data?.[0]?.statut === 'paye'
    }
  }

  // ── KPIs Parent ──────────────────────────────────────────────────────────────
  // For now parent sees summary; full child data is on espace-parent page

  const kpis: EcoleKpis = {
    nbEtudiants:          etuRes.count    ?? 0,
    nbActifs:             actifRes.count  ?? 0,
    nbEnseignants:        ensRes.count    ?? 0,
    nbAbsencesJour:       absJourRes.count ?? 0,
    nbExamensAvenir:      examRes.count   ?? 0,
    nbNotifs:             notifRes.count  ?? 0,
    revenuMois,
    nbPaiementsEnAttente,
    montantImpayes,
    soldeTresorerie,
    nbEmployes,
    nbHeurePending,
    myHeuresTotales,
    myHeuresValidees,
    myNotesMoyenne,
    myAbsences,
    myPaiementOk,
  }

  return (
    <EcoleDashboardClient
      role={roleName}
      nomEcole={nomEcole}
      isFinancial={isFinancial}
      kpis={kpis}
    />
  )
}
