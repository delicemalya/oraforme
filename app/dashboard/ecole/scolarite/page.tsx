'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, X, Check, Search, BookOpen, CreditCard,
  Users2, Unlock, Printer, Loader2, ChevronRight, RefreshCw,
  Calendar, School, ClipboardList, Phone, Mail,
  BookOpenCheck, CalendarRange, FlaskConical, ScrollText,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  type Etudiant, type FraisScolaire, type PaiementScolaire, type Note,
  type ClasseEcole, type PlanningEcole, type Absence, type Enseignant,
  type Niveau, type Periode, type StatutEtu, type TypeEvent,
  STATUT_ETU, NIVEAUX, PERIODES, TYPE_EVENT, DEFAULT_FRAIS,
  fmt, generateCode, calcMoyenne, getMention, printBulletin, printReceipt,
  StatutBadge, Avatar, FI, KpiCard,
} from '../_lib/shared'
import {
  SectionMatieres, SectionSessions, SectionExamens, SectionAttestations,
} from '../_lib/academic-sections'

// ── Sub-tab type ──────────────────────────────────────────────────────────────

type SubTab = 'inscriptions' | 'paiements' | 'notes' | 'classes' | 'planning' | 'absences'
           | 'matieres' | 'sessions' | 'examens' | 'attestations'

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'inscriptions',  label: 'Inscriptions',      icon: Users2 },
  { id: 'paiements',     label: 'Paiements & Frais', icon: CreditCard },
  { id: 'notes',         label: 'Notes & Bulletins', icon: BookOpen },
  { id: 'classes',       label: 'Classes',           icon: School },
  { id: 'planning',      label: 'Planning',          icon: Calendar },
  { id: 'absences',      label: 'Absences',          icon: ClipboardList },
  { id: 'matieres',      label: 'Matières',          icon: BookOpenCheck },
  { id: 'sessions',      label: 'Sessions',          icon: CalendarRange },
  { id: 'examens',       label: 'Examens & Notes',   icon: FlaskConical },
  { id: 'attestations',  label: 'Attestations',      icon: ScrollText },
]

// ── Inscriptions ──────────────────────────────────────────────────────────────

function SectionInscriptions({ tenantId, etudiants, onRefresh, nomEcole }: {
  tenantId: string; etudiants: Etudiant[]; onRefresh: () => void; nomEcole: string
}) {
  const [filter,   setFilter]   = useState<'tous' | StatutEtu>('tous')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<Etudiant | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [genCode,  setGenCode]  = useState(false)

  const [form, setForm] = useState({
    prenom: '', nom: '', date_naissance: '', lieu_naissance: '', nationalite: 'Congolaise', adresse: '',
    niveau: 'lycee' as Niveau, classe: '', statut: 'actif' as StatutEtu,
    nom_pere: '', nom_mere: '', tel_parent: '', email_parent: '', profession_parent: '',
    nom_tuteur: '', tel_tuteur: '', lien_tuteur: '', annee_scolaire: '2024-2025', photo_url: '',
  })

  function sf(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const displayed = etudiants.filter(e => {
    const matchFilter = filter === 'tous' || e.statut === filter
    const q = search.toLowerCase()
    return matchFilter && (!q || (e.nom + ' ' + e.prenom + ' ' + e.numero_id).toLowerCase().includes(q))
  })

  async function save() {
    setSaving(true)
    const { count } = await supabase.from('etudiants').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const year = new Date().getFullYear()
    const num  = `ETU-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`
    const { error } = await supabase.from('etudiants').insert({
      tenant_id: tenantId, numero_id: num, ...form,
      photo_url: form.photo_url || null, date_naissance: form.date_naissance || null,
    })
    if (!error) {
      onRefresh(); setShowForm(false)
      setForm({ prenom: '', nom: '', date_naissance: '', lieu_naissance: '', nationalite: 'Congolaise', adresse: '', niveau: 'lycee', classe: '', statut: 'actif', nom_pere: '', nom_mere: '', tel_parent: '', email_parent: '', profession_parent: '', nom_tuteur: '', tel_tuteur: '', lien_tuteur: '', annee_scolaire: '2024-2025', photo_url: '' })
    }
    setSaving(false)
  }

  async function changeStatut(id: string, statut: StatutEtu) {
    await supabase.from('etudiants').update({ statut }).eq('id', id)
    setSelected(s => s ? { ...s, statut } : s)
    onRefresh()
  }

  async function handleGenCode(id: string) {
    setGenCode(true)
    const code = generateCode()
    await supabase.from('etudiants').update({ code_deblocage: code }).eq('id', id)
    setSelected(s => s ? { ...s, code_deblocage: code } : s)
    onRefresh(); setGenCode(false)
  }

  async function del(id: string) {
    await supabase.from('etudiants').delete().eq('id', id)
    setSelected(null); onRefresh()
  }

  const kpis = [
    { label: 'Total',     value: etudiants.length,                                    color: '#F07900' },
    { label: 'Actifs',    value: etudiants.filter(e => e.statut === 'actif').length,   color: '#2EA043' },
    { label: 'Suspendus', value: etudiants.filter(e => e.statut === 'suspendu').length,color: '#F0A30A' },
    { label: 'Diplômés',  value: etudiants.filter(e => e.statut === 'diplome').length, color: '#8B0073' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />)}
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
          {(['tous', 'actif', 'suspendu', 'banni', 'diplome'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: filter === f ? '#F0A30A' : 'transparent', color: filter === f ? '#0D1117' : '#8B949E' }}>
              {f === 'tous' ? 'Tous' : STATUT_ETU[f as StatutEtu]?.label ?? f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4B5563]" />
            <input className="pl-7 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-[#9CA3AF] focus:outline-none w-44" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#F0A30A,#d4880a)', color: '#0D1117' }}>
            <Plus size={13} /> Inscrire
          </button>
        </div>
      </div>

      {/* ── Grille de cartes Étudiants ───────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-[#4B5563] text-xs space-y-2">
          <Users2 size={32} className="mx-auto opacity-20" />
          <p className="font-medium">Aucun étudiant trouvé.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map((e, i) => {
            const sc = STATUT_ETU[e.statut as StatutEtu] ?? STATUT_ETU.actif
            return (
              <motion.div key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="rounded-xl border border-white/[0.07] p-5 relative flex flex-col gap-3 hover:border-white/[0.18] transition-all"
                style={{ background: 'rgba(255,255,255,0.025)' }}>

                {/* Status badge */}
                <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase"
                  style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>

                {/* Avatar + Nom */}
                <div className="flex flex-col items-center text-center pt-1">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/[0.1] mb-2 shrink-0">
                    <Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={64} />
                  </div>
                  <p className="text-sm font-bold text-white leading-tight">{e.prenom} {e.nom}</p>
                  <p className="text-[10px] font-mono text-[#8B0073] mt-0.5 bg-[#8B0073]/10 px-2 py-0.5 rounded-full">{e.numero_id}</p>
                </div>

                {/* Niveau + Classe */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-center">
                  <div>
                    <p className="text-[9px] text-[#6B7280] uppercase tracking-wide">Niveau</p>
                    <p className="text-[10px] text-white mt-0.5">{NIVEAUX.find(n => n.value === e.niveau)?.label ?? e.niveau}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#6B7280] uppercase tracking-wide">Classe</p>
                    <p className="text-[10px] text-white mt-0.5 truncate">{e.classe ?? '—'}</p>
                  </div>
                </div>

                {/* Contact parent */}
                <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                  {e.tel_parent && (
                    <div className="flex items-center gap-2">
                      <Phone size={11} className="text-[#6B7280] shrink-0" />
                      <p className="text-[11px] text-[#4B5563]">{e.tel_parent}</p>
                    </div>
                  )}
                  {e.email_parent && (
                    <div className="flex items-center gap-2">
                      <Mail size={11} className="text-[#6B7280] shrink-0" />
                      <p className="text-[11px] text-[#4B5563] truncate">{e.email_parent}</p>
                    </div>
                  )}
                  {!e.tel_parent && !e.email_parent && (
                    <p className="text-[11px] text-[#6B7280]">Aucun contact parent</p>
                  )}
                </div>

                {/* Boutons */}
                <div className="flex gap-2 pt-1 mt-auto">
                  <button onClick={() => del(e.id)}
                    className="p-2 rounded-lg border border-white/[0.06] text-[#6B7280] hover:text-red-400 hover:border-red-400/30 transition-all"
                    title="Supprimer">
                    <Trash2 size={12} />
                  </button>
                  <button onClick={() => setSelected(selected?.id === e.id ? null : e)}
                    className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg text-white transition-all hover:opacity-90"
                    style={{ background: selected?.id === e.id ? '#F0A30A' : 'linear-gradient(135deg,#F07900,#1a6fd4)' }}>
                    {selected?.id === e.id ? 'Fermer' : 'Gérer'}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Panneau de gestion flottant ─────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 right-6 z-40 w-80 rounded-2xl border border-white/[0.1] shadow-2xl overflow-hidden"
            style={{ background: '#161B22' }}>
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar nom={selected.nom} prenom={selected.prenom} photoUrl={selected.photo_url} size={40} />
                  <div>
                    <p className="text-sm font-bold text-white">{selected.prenom} {selected.nom}</p>
                    <p className="text-[10px] font-mono text-[#8B0073]">{selected.numero_id} · {selected.classe ?? selected.niveau}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-[#4B5563] hover:text-white"><X size={15} /></button>
              </div>

              <div className="space-y-1 text-xs text-[#4B5563]">
                {selected.date_naissance && <p>Né(e) le : <span className="text-white">{new Date(selected.date_naissance).toLocaleDateString('fr-FR')}</span></p>}
                {selected.adresse && <p>Adresse : <span className="text-white">{selected.adresse}</span></p>}
                {selected.tel_parent && <p>Parent : <span className="text-white">{selected.tel_parent}</span></p>}
                {selected.nom_pere && <p>Père : <span className="text-white">{selected.nom_pere}</span></p>}
                {selected.nom_mere && <p>Mère : <span className="text-white">{selected.nom_mere}</span></p>}
              </div>

              <div>
                <p className="text-[10px] text-[#4B5563] uppercase tracking-wider mb-1.5">Modifier le statut</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['actif', 'suspendu', 'banni', 'diplome'] as const).map(s => {
                    const cfg = STATUT_ETU[s]
                    return (
                      <button key={s} onClick={() => changeStatut(selected.id, s)} className="py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                        style={{ background: selected.statut === s ? cfg.bg : 'rgba(255,255,255,0.04)', color: selected.statut === s ? cfg.color : '#8B949E', border: `1px solid ${selected.statut === s ? cfg.color + '40' : 'transparent'}` }}>
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {selected.statut === 'suspendu' && (
                <div className="border border-[#F0A30A]/20 rounded-lg p-3" style={{ background: 'rgba(240,163,10,0.06)' }}>
                  {selected.code_deblocage ? (
                    <>
                      <p className="text-[10px] text-[#4B5563] mb-1">Code de déblocage :</p>
                      <p className="text-xl font-mono font-bold text-[#F0A30A] tracking-widest">{selected.code_deblocage}</p>
                    </>
                  ) : (
                    <button onClick={() => handleGenCode(selected.id)} disabled={genCode} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#F0A30A]/15 text-[#F0A30A] text-xs font-semibold">
                      {genCode ? <Loader2 className="animate-spin" size={12} /> : <Unlock size={12} />} Générer code déblocage
                    </button>
                  )}
                </div>
              )}

              <button onClick={() => del(selected.id)} className="w-full py-2 rounded-lg text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1">
                <Trash2 size={11} /> Supprimer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} />
            <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="w-full max-w-3xl bg-white border border-white/[0.08] rounded-2xl shadow-2xl" initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                  <h2 className="text-base font-bold text-white">Inscrire un étudiant</h2>
                  <button onClick={() => setShowForm(false)} className="text-[#4B5563] hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-6 grid grid-cols-2 gap-5">
                  <div className="col-span-2"><p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-3">Informations personnelles</p></div>
                  {([['Prénom *', 'prenom', 'Éric'], ['Nom *', 'nom', 'MBEMBA'], ['Date de naissance', 'date_naissance', '', 'date'], ['Lieu de naissance', 'lieu_naissance', 'Brazzaville'], ['Nationalité', 'nationalite', 'Congolaise'], ['Adresse', 'adresse', '']] as [string,string,string,string?][]).map(([label, key, ph, type]) => (
                    <FI key={key} label={label} value={(form as Record<string, string>)[key]} onChange={v => sf(key, v)} placeholder={ph} type={type || 'text'} />
                  ))}
                  <div>
                    <label className="block text-xs text-[#4B5563] mb-1.5">Niveau</label>
                    <select value={form.niveau} onChange={e => sf('niveau', e.target.value)} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                      {NIVEAUX.map(n => <option key={n.value} value={n.value} className="bg-white">{n.label}</option>)}
                    </select>
                  </div>
                  <FI label="Classe / Filière" value={form.classe} onChange={v => sf('classe', v)} placeholder="Terminale A, L3 Informatique…" />
                  <FI label="Année scolaire" value={form.annee_scolaire} onChange={v => sf('annee_scolaire', v)} placeholder="2024-2025" />
                  <FI label="Photo (URL)" value={form.photo_url} onChange={v => sf('photo_url', v)} placeholder="https://…/photo.jpg" />

                  <div className="col-span-2 border-t border-white/[0.06] pt-4"><p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-3">Parents & Tuteur</p></div>
                  {([['Nom du père', 'nom_pere', ''], ['Nom de la mère', 'nom_mere', ''], ['Téléphone parent', 'tel_parent', '+242 06…'], ['Email parent', 'email_parent', ''], ['Profession', 'profession_parent', ''], ['Nom tuteur', 'nom_tuteur', ''], ['Tél tuteur', 'tel_tuteur', ''], ['Lien (ex: oncle)', 'lien_tuteur', '']] as [string,string,string][]).map(([label, key, ph]) => (
                    <FI key={key} label={label} value={(form as Record<string, string>)[key]} onChange={v => sf(key, v)} placeholder={ph} />
                  ))}

                  <div className="col-span-2 flex gap-3 pt-2">
                    <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-[#4B5563] text-sm">Annuler</button>
                    <button onClick={save} disabled={saving || !form.nom || !form.prenom} className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#F0A30A,#d4880a)', color: '#0D1117' }}>
                      {saving ? <Loader2 className="animate-spin" size={14} /> : <><Check size={14} /> Inscrire</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Paiements & Frais ─────────────────────────────────────────────────────────

function SectionPaiements({ tenantId, etudiants, nomEcole }: {
  tenantId: string; etudiants: Etudiant[]; nomEcole: string
}) {
  const [frais,        setFrais]        = useState<FraisScolaire[]>([])
  const [paiements,    setPaiements]    = useState<PaiementScolaire[]>([])
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [showNewFrais, setShowNewFrais] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [fraisForm,    setFraisForm]    = useState({ libelle: '', montant: '', type_frais: 'inscription' })
  const [paieForm,     setPaieForm]     = useState({ libelle: '', montant: '', frais_id: '', methode: 'especes' })

  const loadFrais = useCallback(async () => {
    const { data } = await supabase.from('frais_scolaires').select('*').eq('tenant_id', tenantId).order('ordre').order('created_at')
    setFrais((data ?? []) as FraisScolaire[])
  }, [tenantId])

  const loadPaiements = useCallback(async () => {
    if (!selectedId) return
    const { data } = await supabase.from('paiements_scolaires').select('*').eq('etudiant_id', selectedId).order('created_at', { ascending: false })
    setPaiements((data ?? []) as PaiementScolaire[])
  }, [selectedId])

  useEffect(() => { loadFrais() }, [loadFrais])
  useEffect(() => { loadPaiements() }, [loadPaiements])

  async function initFrais() {
    for (const f of DEFAULT_FRAIS) {
      await supabase.from('frais_scolaires').insert({ tenant_id: tenantId, ...f, actif: true, obligatoire: false, ordre: 0 })
    }
    loadFrais()
  }

  async function addFrais() {
    if (!fraisForm.libelle) return
    setSaving(true)
    await supabase.from('frais_scolaires').insert({ tenant_id: tenantId, libelle: fraisForm.libelle, montant: Number(fraisForm.montant), type_frais: fraisForm.type_frais, actif: true, obligatoire: false, ordre: frais.length })
    setFraisForm({ libelle: '', montant: '', type_frais: 'inscription' })
    setShowNewFrais(false); loadFrais(); setSaving(false)
  }

  async function addPaiement() {
    if (!selectedId || !paieForm.libelle || !paieForm.montant) return
    setSaving(true)
    const montant = Number(paieForm.montant)
    const today   = new Date().toISOString().split('T')[0]
    const etu     = etudiants.find(e => e.id === selectedId)
    const desc    = `Scolarité — ${paieForm.libelle}${etu ? ` — ${etu.prenom} ${etu.nom}` : ''}`
    await supabase.from('paiements_scolaires').insert({
      tenant_id: tenantId, etudiant_id: selectedId, frais_id: paieForm.frais_id || null,
      libelle: paieForm.libelle, montant, annee: new Date().getFullYear(), statut: 'paye', methode: paieForm.methode,
    })
    await supabase.from('transactions').insert({
      tenant_id: tenantId, type: 'entree', categorie: 'Scolarité',
      description: desc, montant, mode_paiement: paieForm.methode,
      date: today, reference: etu?.numero_id ?? null, source: 'paiement_scolaire',
    })
    await supabase.from('journal_comptable').insert({
      tenant_id: tenantId, date: today, libelle: desc,
      type: 'recette', montant_ht: montant, tva: 0, ca: 0,
      montant_ttc: montant, categorie: '701 — Prestations éducatives',
    })

    // Notify parent + direction of payment received
    if (etu) {
      try {
        await supabase.from('notifications').insert({
          tenant_id: tenantId, etudiant_id: selectedId,
          type: 'paiement_scolaire',
          titre: `Paiement reçu — ${etu.prenom} ${etu.nom}`,
          message: `Paiement de ${new Intl.NumberFormat('fr-FR').format(montant)} FCFA reçu pour « ${paieForm.libelle} ». Méthode : ${paieForm.methode}.`,
          destinataire_role: 'PARENT',
          destinataire_contact: etu.tel_parent ?? etu.email_parent ?? null,
          date_event: today, read: false,
        })
      } catch {}
      try {
        await supabase.from('notifications').insert({
          tenant_id: tenantId, etudiant_id: selectedId,
          type: 'paiement_scolaire',
          titre: `Paiement scolarité — ${etu.prenom} ${etu.nom}`,
          message: `${new Intl.NumberFormat('fr-FR').format(montant)} FCFA reçus via ${paieForm.methode} — ${paieForm.libelle}.`,
          destinataire_role: 'DIRECTION_GENERALE',
          date_event: today, read: false,
        })
      } catch {}
    }

    setPaieForm({ libelle: '', montant: '', frais_id: '', methode: 'especes' })
    loadPaiements(); setSaving(false)
  }

  async function delPaiement(id: string) {
    await supabase.from('paiements_scolaires').delete().eq('id', id)
    setPaiements(p => p.filter(x => x.id !== id))
  }

  const selectedEtu = etudiants.find(e => e.id === selectedId)
  const totalPaye   = paiements.filter(p => p.statut === 'paye').reduce((s, p) => s + p.montant, 0)

  return (
    <div className="flex gap-5">
      <div className="w-56 shrink-0 rounded-xl border border-white/[0.06] overflow-hidden h-fit" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-3 py-2 border-b border-white/[0.06]"><p className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider">Étudiants</p></div>
        <div className="overflow-y-auto max-h-[520px]">
          {etudiants.map(e => (
            <button key={e.id} onClick={() => setSelectedId(e.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors border-b border-white/[0.04] ${selectedId === e.id ? 'bg-[#F0A30A]/10' : 'hover:bg-white/[0.02]'}`}>
              <Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={26} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{e.prenom} {e.nom}</p>
                <p className="text-[10px] text-[#4B5563]">{e.classe ?? e.niveau}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {!selectedEtu ? (
        <div className="flex-1 flex items-center justify-center text-[#4B5563] h-64">
          <div className="text-center"><CreditCard size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Sélectionnez un étudiant</p></div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Avatar nom={selectedEtu.nom} prenom={selectedEtu.prenom} photoUrl={selectedEtu.photo_url} size={40} />
              <div>
                <p className="text-sm font-bold text-white">{selectedEtu.prenom} {selectedEtu.nom}</p>
                <p className="text-xs text-[#4B5563]">{selectedEtu.numero_id} · {selectedEtu.classe ?? selectedEtu.niveau}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#4B5563]">Total payé</p>
              <p className="text-lg font-bold text-[#2EA043]">{fmt(totalPaye)} FCFA</p>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Frais configurés</p>
              <div className="flex gap-2">
                {frais.length === 0 && <button onClick={initFrais} className="text-[10px] text-[#F0A30A] hover:underline">Initialiser frais par défaut</button>}
                <button onClick={() => setShowNewFrais(p => !p)} className="text-[10px] text-[#8B0073] hover:underline flex items-center gap-1"><Plus size={10} /> Ajouter</button>
              </div>
            </div>
            {showNewFrais && (
              <div className="flex gap-2 mb-3">
                <input className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs text-white" placeholder="Libellé" value={fraisForm.libelle} onChange={e => setFraisForm(p => ({ ...p, libelle: e.target.value }))} />
                <input type="number" className="w-24 bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs text-white text-right" placeholder="Montant" value={fraisForm.montant} onChange={e => setFraisForm(p => ({ ...p, montant: e.target.value }))} />
                <button onClick={addFrais} disabled={saving} className="px-3 py-1.5 rounded-md bg-[#8B0073]/10 text-[#8B0073] text-xs font-semibold"><Check size={12} /></button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {frais.map(f => (
                <div key={f.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <span className="text-xs text-white">{f.libelle}</span>
                  <span className="text-[10px] font-bold text-[#F0A30A]">{fmt(f.montant)} FCFA</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-3">Enregistrer un paiement</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Libellé</label>
                <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white" value={paieForm.libelle} onChange={e => setPaieForm(p => ({ ...p, libelle: e.target.value }))} placeholder="Mensualité Octobre…" />
              </div>
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Frais (optionnel)</label>
                <select className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white" value={paieForm.frais_id} onChange={e => setPaieForm(p => ({ ...p, frais_id: e.target.value, libelle: e.target.value ? frais.find(f => f.id === e.target.value)?.libelle ?? p.libelle : p.libelle }))}>
                  <option value="" className="bg-white">— Manuel —</option>
                  {frais.map(f => <option key={f.id} value={f.id} className="bg-white">{f.libelle} ({fmt(f.montant)} FCFA)</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Montant (FCFA)</label>
                <input type="number" className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white text-right" value={paieForm.montant} onChange={e => setPaieForm(p => ({ ...p, montant: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Méthode</label>
                <select className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white" value={paieForm.methode} onChange={e => setPaieForm(p => ({ ...p, methode: e.target.value }))}>
                  {['especes', 'mobile_money', 'virement', 'cheque'].map(m => <option key={m} value={m} className="bg-white">{m.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addPaiement} disabled={saving || !paieForm.libelle || !paieForm.montant} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#2EA043', color: '#fff' }}>
              {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer le paiement
            </button>
          </div>

          {paiements.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-white/[0.06]"><p className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider">Historique</p></div>
              <table className="w-full text-xs">
                <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Date', 'Libellé', 'Méthode', 'Montant', ''].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] text-[#4B5563]">{h}</th>)}</tr></thead>
                <tbody>
                  {paiements.map(p => (
                    <tr key={p.id} className="border-t border-white/[0.04]">
                      <td className="px-3 py-2 text-[#4B5563]">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-2 text-white">{p.libelle}</td>
                      <td className="px-3 py-2 text-[#4B5563] capitalize">{p.methode.replace('_', ' ')}</td>
                      <td className="px-3 py-2 font-semibold text-[#2EA043]">{fmt(p.montant)} FCFA</td>
                      <td className="px-3 py-2 flex items-center gap-1.5">
                        <button onClick={() => selectedEtu && printReceipt(selectedEtu, p, nomEcole)} className="text-[#6B7280] hover:text-[#8B0073]"><Printer size={11} /></button>
                        <button onClick={() => delPaiement(p.id)} className="text-[#6B7280] hover:text-red-400"><Trash2 size={11} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Notes & Bulletins ─────────────────────────────────────────────────────────

function SectionNotes({ tenantId, etudiants, nomEcole }: {
  tenantId: string; etudiants: Etudiant[]; nomEcole: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notes,      setNotes]      = useState<Note[]>([])
  const [periode,    setPeriode]    = useState<Periode>('trimestre1')
  const [saving,     setSaving]     = useState(false)
  const [form, setForm] = useState({ matiere: '', type_note: 'devoir', note: '', note_max: '20', coefficient: '1', annee_scolaire: '2024-2025' })

  useEffect(() => {
    if (!selectedId) return
    supabase.from('notes_etudiants').select('*').eq('etudiant_id', selectedId)
      .then(({ data }) => setNotes((data ?? []) as Note[]))
  }, [selectedId])

  async function addNote() {
    if (!selectedId || !form.matiere || !form.note) return
    setSaving(true)
    const { data } = await supabase.from('notes_etudiants').insert({
      tenant_id: tenantId, etudiant_id: selectedId, matiere: form.matiere,
      type_note: form.type_note, note: Number(form.note), note_max: Number(form.note_max),
      coefficient: Number(form.coefficient), periode, annee_scolaire: form.annee_scolaire,
    }).select().single()
    if (data) setNotes(p => [...p, data as Note])
    setForm(p => ({ ...p, note: '' })); setSaving(false)
  }

  async function delNote(id: string) {
    await supabase.from('notes_etudiants').delete().eq('id', id)
    setNotes(p => p.filter(n => n.id !== id))
  }

  const periodeNotes = notes.filter(n => n.periode === periode)
  const moyenne      = calcMoyenne(notes, periode)
  const mention      = moyenne !== null ? getMention(moyenne) : null
  const selectedEtu  = etudiants.find(e => e.id === selectedId)

  return (
    <div className="flex gap-5">
      <div className="w-52 shrink-0 rounded-xl border border-white/[0.06] overflow-hidden h-fit" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-3 py-2 border-b border-white/[0.06]"><p className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider">Étudiant</p></div>
        {etudiants.map(e => (
          <button key={e.id} onClick={() => setSelectedId(e.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors border-b border-white/[0.04] ${selectedId === e.id ? 'bg-[#F0A30A]/10' : 'hover:bg-white/[0.02]'}`}>
            <Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={24} />
            <p className="text-xs font-medium text-white truncate">{e.prenom} {e.nom}</p>
          </button>
        ))}
      </div>

      {!selectedEtu ? (
        <div className="flex-1 flex items-center justify-center text-[#4B5563]">
          <div className="text-center"><BookOpen size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Sélectionnez un étudiant</p></div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
              {PERIODES.map(p => (
                <button key={p.value} onClick={() => setPeriode(p.value)} className="px-2.5 py-1 rounded-md text-xs font-medium transition-all" style={{ background: periode === p.value ? '#F0A30A' : 'transparent', color: periode === p.value ? '#0D1117' : '#8B949E' }}>{p.label}</button>
              ))}
            </div>
            {moyenne !== null && mention && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{moyenne.toFixed(2)} / 20</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: mention.color, background: mention.color + '20' }}>{mention.label}</span>
                <button onClick={() => printBulletin(selectedEtu, notes, periode, nomEcole)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B0073]/10 border border-[#8B0073]/30 text-[#8B0073] text-xs font-semibold">
                  <Printer size={12} /> Bulletin PDF
                </button>
              </div>
            )}
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-3">Ajouter une note</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-[#4B5563] block mb-1">Matière *</label>
                <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white" value={form.matiere} onChange={e => setForm(p => ({ ...p, matiere: e.target.value }))} placeholder="Mathématiques…" />
              </div>
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Type</label>
                <select className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white" value={form.type_note} onChange={e => setForm(p => ({ ...p, type_note: e.target.value }))}>
                  {['devoir', 'examen', 'tp', 'oral', 'projet'].map(t => <option key={t} value={t} className="bg-white">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Coeff.</label>
                <input type="number" min="0.5" step="0.5" className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white text-center" value={form.coefficient} onChange={e => setForm(p => ({ ...p, coefficient: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Note *</label>
                <input type="number" min="0" className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white text-right" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Sur</label>
                <input type="number" min="10" className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white text-right" value={form.note_max} onChange={e => setForm(p => ({ ...p, note_max: e.target.value }))} />
              </div>
            </div>
            <button onClick={addNote} disabled={saving || !form.matiere || !form.note} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#F0A30A', color: '#0D1117' }}>
              {saving ? <Loader2 className="animate-spin" size={12} /> : <Plus size={12} />} Ajouter
            </button>
          </div>

          {periodeNotes.length > 0 ? (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Matière', 'Type', 'Note', '/Max', 'Coeff.', 'Moy /20', ''].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] text-[#4B5563]">{h}</th>)}</tr></thead>
                <tbody>
                  {periodeNotes.map(n => {
                    const moy20 = (n.note / n.note_max) * 20
                    const m = getMention(moy20)
                    return (
                      <tr key={n.id} className="border-t border-white/[0.04]">
                        <td className="px-3 py-2 font-medium text-white">{n.matiere}</td>
                        <td className="px-3 py-2 text-[#4B5563] capitalize">{n.type_note}</td>
                        <td className="px-3 py-2 font-bold text-white">{n.note}</td>
                        <td className="px-3 py-2 text-[#4B5563]">{n.note_max}</td>
                        <td className="px-3 py-2 text-[#4B5563]">×{n.coefficient}</td>
                        <td className="px-3 py-2"><span className="font-bold px-1.5 py-0.5 rounded text-[10px]" style={{ color: m.color, background: m.color + '20' }}>{moy20.toFixed(2)}</span></td>
                        <td className="px-3 py-2"><button onClick={() => delNote(n.id)} className="text-[#6B7280] hover:text-red-400"><Trash2 size={11} /></button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-[#4B5563] text-xs">Aucune note pour {PERIODES.find(p => p.value === periode)?.label}.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Classes ───────────────────────────────────────────────────────────────────

function SectionClasses({ tenantId, classes, onRefresh }: {
  tenantId: string; classes: ClasseEcole[]; onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ nom: '', niveau: 'lycee', annee_scolaire: '2024-2025', nb_places: '30' })

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('classes_ecole').insert({
      tenant_id: tenantId, nom: form.nom.trim(), niveau: form.niveau,
      annee_scolaire: form.annee_scolaire, nb_places: Number(form.nb_places) || 30,
    })
    if (!error) { onRefresh(); setShowForm(false); setForm({ nom: '', niveau: 'lycee', annee_scolaire: '2024-2025', nb_places: '30' }) }
    setSaving(false)
  }

  async function del(id: string) {
    await supabase.from('classes_ecole').delete().eq('id', id); onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#F0A30A,#d4880a)', color: '#0D1117' }}>
          <Plus size={13} /> Nouvelle classe
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#F0A30A]/30 p-4 space-y-3" style={{ background: 'rgba(240,163,10,0.04)' }}>
            <p className="text-xs font-bold text-[#F0A30A]">Nouvelle classe</p>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Nom *" value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} placeholder="Terminale A, L1 Info…" />
              <div>
                <label className="block text-xs text-[#4B5563] mb-1">Niveau</label>
                <select value={form.niveau} onChange={e => setForm(p => ({ ...p, niveau: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <FI label="Année scolaire" value={form.annee_scolaire} onChange={v => setForm(p => ({ ...p, annee_scolaire: v }))} />
              <FI label="Nb. places" value={form.nb_places} onChange={v => setForm(p => ({ ...p, nb_places: v }))} type="number" />
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.nom} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#F0A30A', color: '#0D1117' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[#4B5563] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {classes.length === 0 ? (
        <div className="text-center py-12 text-[#4B5563] text-xs">Aucune classe enregistrée.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {classes.map(c => {
            const niv = NIVEAUX.find(n => n.value === c.niveau)
            return (
              <div key={c.id} className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{c.nom}</p>
                    <p className="text-[10px] text-[#4B5563] mt-0.5">{niv?.label ?? c.niveau} · {c.annee_scolaire}</p>
                  </div>
                  <button onClick={() => del(c.id)} className="text-[#6B7280] hover:text-red-400"><Trash2 size={12} /></button>
                </div>
                <div className="mt-3 text-right">
                  <span className="text-[10px] font-semibold text-[#8B0073]">{c.nb_places} places</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Planning ──────────────────────────────────────────────────────────────────

function SectionPlanning({ tenantId, planning, onRefresh }: {
  tenantId: string; planning: PlanningEcole[]; onRefresh: () => void
}) {
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [filterType, setFilterType] = useState<'tous' | TypeEvent>('tous')
  const [form, setForm] = useState({ titre: '', description: '', date_debut: '', date_fin: '', type: 'evenement' as TypeEvent })

  const today     = new Date().toISOString().slice(0, 10)
  const displayed = planning.filter(p => filterType === 'tous' || p.type === filterType).sort((a, b) => a.date_debut.localeCompare(b.date_debut))

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('planning_ecole').insert({
      tenant_id: tenantId, titre: form.titre.trim(), description: form.description || null,
      date_debut: form.date_debut, date_fin: form.date_fin || null, type: form.type,
    })
    if (!error) { onRefresh(); setShowForm(false); setForm({ titre: '', description: '', date_debut: '', date_fin: '', type: 'evenement' }) }
    setSaving(false)
  }

  async function del(id: string) {
    await supabase.from('planning_ecole').delete().eq('id', id); onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total événements" value={planning.length} color="#F07900" />
        <KpiCard label="À venir" value={planning.filter(p => p.date_debut >= today).length} color="#2EA043" />
        <KpiCard label="Examens" value={planning.filter(p => p.type === 'examen').length} color="#F01F38" />
      </div>

      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
          {(['tous', 'examen', 'conge_scolaire', 'evenement', 'conseil', 'autre'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all" style={{ background: filterType === t ? '#F0A30A' : 'transparent', color: filterType === t ? '#0D1117' : '#8B949E' }}>
              {t === 'tous' ? 'Tous' : TYPE_EVENT[t as TypeEvent]?.label ?? t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#F0A30A,#d4880a)', color: '#0D1117' }}>
          <Plus size={13} /> Ajouter
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#F0A30A]/30 p-4 space-y-3" style={{ background: 'rgba(240,163,10,0.04)' }}>
            <p className="text-xs font-bold text-[#F0A30A]">Nouvel événement</p>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Titre *" value={form.titre} onChange={v => setForm(p => ({ ...p, titre: v }))} />
              <div>
                <label className="block text-xs text-[#4B5563] mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as TypeEvent }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  {(Object.entries(TYPE_EVENT) as [TypeEvent, { label: string }][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <FI label="Date début *" value={form.date_debut} onChange={v => setForm(p => ({ ...p, date_debut: v }))} type="date" />
              <FI label="Date fin"     value={form.date_fin}   onChange={v => setForm(p => ({ ...p, date_fin: v }))}   type="date" />
              <div className="col-span-2">
                <label className="block text-xs text-[#4B5563] mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.titre || !form.date_debut} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#F0A30A', color: '#0D1117' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[#4B5563] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {displayed.length === 0 ? (
        <div className="text-center py-12 text-[#4B5563] text-xs">Aucun événement planifié.</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(p => {
            const t = TYPE_EVENT[p.type] ?? TYPE_EVENT.autre
            const isPast = p.date_debut < today
            return (
              <div key={p.id} className="rounded-xl border border-white/[0.06] p-4 flex items-start gap-4" style={{ background: 'rgba(255,255,255,0.02)', opacity: isPast ? 0.55 : 1 }}>
                <div className="rounded-lg p-2.5 shrink-0" style={{ background: t.bg }}>
                  <Calendar size={14} style={{ color: t.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{p.titre}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: t.color, background: t.bg }}>{t.label}</span>
                  </div>
                  {p.description && <p className="text-[11px] text-[#4B5563] mt-0.5 line-clamp-1">{p.description}</p>}
                  <p className="text-[10px] text-[#6B7280] mt-1">
                    {new Date(p.date_debut + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    {p.date_fin && ` → ${new Date(p.date_fin + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
                  </p>
                </div>
                <button onClick={() => del(p.id)} className="text-[#6B7280] hover:text-red-400 shrink-0"><Trash2 size={12} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Absences ──────────────────────────────────────────────────────────────────

function SectionAbsences({ tenantId, etudiants }: { tenantId: string; etudiants: Etudiant[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [absences,   setAbsences]   = useState<Absence[]>([])
  const [saving,     setSaving]     = useState(false)
  const [form, setForm] = useState({ date_absence: new Date().toISOString().split('T')[0], matiere: '', justifiee: false, motif: '' })

  useEffect(() => {
    if (!selectedId) return
    supabase.from('absences_etudiants').select('*').eq('etudiant_id', selectedId)
      .order('date_absence', { ascending: false })
      .then(({ data }) => setAbsences((data ?? []) as Absence[]))
  }, [selectedId])

  async function addAbsence() {
    if (!selectedId || !form.date_absence) return
    setSaving(true)
    const { data } = await supabase.from('absences_etudiants').insert({
      tenant_id: tenantId, etudiant_id: selectedId,
      date_absence: form.date_absence, matiere: form.matiere || null,
      justifiee: form.justifiee, motif: form.motif || null,
      notifie_parent: true,
    }).select().single()
    if (data) setAbsences(p => [data as Absence, ...p])

    // Notify parent + direction
    const etu = etudiants.find(e => e.id === selectedId)
    if (etu) {
      const notifBase = {
        tenant_id: tenantId,
        etudiant_id: selectedId,
        date_event: form.date_absence,
        read: false,
      }
      const matLabel = form.matiere ? ` en ${form.matiere}` : ''
      try {
        await supabase.from('notifications').insert({
          ...notifBase,
          type: 'absence_etudiant',
          titre: `Absence — ${etu.prenom} ${etu.nom}`,
          message: `${etu.prenom} ${etu.nom} était absent(e)${matLabel} le ${new Date(form.date_absence).toLocaleDateString('fr-FR')}${form.justifiee ? ' (justifiée)' : ''}.`,
          destinataire_role: 'PARENT',
          destinataire_contact: etu.tel_parent ?? etu.email_parent ?? null,
        })
      } catch {}
      try {
        await supabase.from('notifications').insert({
          ...notifBase,
          type: 'absence_etudiant',
          titre: `Absence signalée — ${etu.prenom} ${etu.nom}`,
          message: `Absence${matLabel} marquée le ${new Date(form.date_absence).toLocaleDateString('fr-FR')}.`,
          destinataire_role: 'DIRECTION_GENERALE',
        })
      } catch {}
    }

    setForm(p => ({ ...p, matiere: '', motif: '', justifiee: false }))
    setSaving(false)
  }

  async function delAbsence(id: string) {
    await supabase.from('absences_etudiants').delete().eq('id', id)
    setAbsences(p => p.filter(a => a.id !== id))
  }

  const selectedEtu = etudiants.find(e => e.id === selectedId)
  const totalAbs    = absences.length
  const justified   = absences.filter(a => a.justifiee).length

  return (
    <div className="flex gap-5">
      <div className="w-52 shrink-0 rounded-xl border border-white/[0.06] overflow-hidden h-fit" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-3 py-2 border-b border-white/[0.06]"><p className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider">Étudiant</p></div>
        <div className="overflow-y-auto max-h-[480px]">
          {etudiants.map(e => (
            <button key={e.id} onClick={() => setSelectedId(e.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-white/[0.04] ${selectedId === e.id ? 'bg-[#F0A30A]/10' : 'hover:bg-white/[0.02]'}`}>
              <Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={24} />
              <p className="text-xs font-medium text-white truncate">{e.prenom} {e.nom}</p>
            </button>
          ))}
        </div>
      </div>

      {!selectedEtu ? (
        <div className="flex-1 flex items-center justify-center text-[#4B5563]">
          <div className="text-center"><ClipboardList size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Sélectionnez un étudiant</p></div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Total absences"  value={totalAbs}            color="#F07900" />
            <KpiCard label="Justifiées"      value={justified}           color="#2EA043" />
            <KpiCard label="Non justifiées"  value={totalAbs - justified} color="#F01F38" />
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-3">Enregistrer une absence</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Date *</label>
                <input type="date" className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white" value={form.date_absence} onChange={e => setForm(p => ({ ...p, date_absence: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Matière</label>
                <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white" placeholder="Mathématiques…" value={form.matiere} onChange={e => setForm(p => ({ ...p, matiere: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] text-[#4B5563] block mb-1">Motif</label>
                <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-2 text-xs text-white" placeholder="Maladie…" value={form.motif} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.justifiee} onChange={e => setForm(p => ({ ...p, justifiee: e.target.checked }))} className="accent-[#F0A30A]" />
                  <span className="text-xs text-[#4B5563]">Justifiée</span>
                </label>
              </div>
            </div>
            <button onClick={addAbsence} disabled={saving || !form.date_absence} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#F0A30A', color: '#0D1117' }}>
              {saving ? <Loader2 className="animate-spin" size={12} /> : <Plus size={12} />} Enregistrer
            </button>
          </div>

          {absences.length === 0 ? (
            <div className="text-center py-8 text-[#4B5563] text-xs">Aucune absence enregistrée.</div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Date', 'Matière', 'Motif', 'Statut', ''].map(h => <th key={h} className="text-left px-3 py-2.5 text-[10px] text-[#4B5563]">{h}</th>)}</tr></thead>
                <tbody>
                  {absences.map(a => (
                    <tr key={a.id} className="border-t border-white/[0.04]">
                      <td className="px-3 py-2.5 text-[#4B5563]">{new Date(a.date_absence + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-2.5 text-white">{a.matiere ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[#4B5563]">{a.motif ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={a.justifiee ? { color: '#2EA043', background: '#2EA04320' } : { color: '#F01F38', background: '#F01F3820' }}>
                          {a.justifiee ? 'Justifiée' : 'Non justifiée'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5"><button onClick={() => delAbsence(a.id)} className="text-[#6B7280] hover:text-red-400"><Trash2 size={11} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ScolaritePage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [subTab,      setSubTab]      = useState<SubTab>('inscriptions')
  const [etudiants,   setEtudiants]   = useState<Etudiant[]>([])
  const [classes,     setClasses]     = useState<ClasseEcole[]>([])
  const [planning,    setPlanning]    = useState<PlanningEcole[]>([])
  const [enseignants, setEnseignants] = useState<Enseignant[]>([])
  const [loading,     setLoading]     = useState(true)
  const [nomEcole,    setNomEcole]    = useState('Mon École')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: etus }, { data: tenant }, { data: cls }, { data: plan }, { data: ens }] = await Promise.all([
      supabase.from('etudiants').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('tenants').select('nom_entreprise').eq('id', tenantId).maybeSingle(),
      supabase.from('classes_ecole').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('planning_ecole').select('*').eq('tenant_id', tenantId).order('date_debut'),
      supabase.from('enseignants').select('*').eq('tenant_id', tenantId).order('nom'),
    ])
    setEtudiants((etus ?? []) as Etudiant[])
    setClasses((cls ?? []) as ClasseEcole[])
    setPlanning((plan ?? []) as PlanningEcole[])
    setEnseignants((ens ?? []) as Enseignant[])
    if (tenant?.nom_entreprise) setNomEcole(tenant.nom_entreprise)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#4B5563]">
        <Loader2 className="animate-spin mr-2" size={18} /> Chargement…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Scolarité</h1>
          <p className="text-xs text-[#4B5563] mt-0.5">{nomEcole} · {etudiants.length} étudiant(s) inscrits</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-white/[0.08] text-[#4B5563] hover:text-white transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit flex-wrap">
        {SUB_TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ background: subTab === t.id ? '#F0A30A' : 'transparent', color: subTab === t.id ? '#0D1117' : '#8B949E' }}>
              <Icon size={12} /> {t.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={subTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {subTab === 'inscriptions' && tenantId && <SectionInscriptions tenantId={tenantId} etudiants={etudiants} onRefresh={load} nomEcole={nomEcole} />}
          {subTab === 'paiements'    && tenantId && <SectionPaiements    tenantId={tenantId} etudiants={etudiants} nomEcole={nomEcole} />}
          {subTab === 'notes'        && tenantId && <SectionNotes        tenantId={tenantId} etudiants={etudiants} nomEcole={nomEcole} />}
          {subTab === 'classes'      && tenantId && <SectionClasses      tenantId={tenantId} classes={classes} onRefresh={load} />}
          {subTab === 'planning'     && tenantId && <SectionPlanning     tenantId={tenantId} planning={planning} onRefresh={load} />}
          {subTab === 'absences'     && tenantId && <SectionAbsences     tenantId={tenantId} etudiants={etudiants} />}
          {subTab === 'matieres'     && tenantId && <SectionMatieres     tenantId={tenantId} enseignants={enseignants} />}
          {subTab === 'sessions'     && tenantId && <SectionSessions     tenantId={tenantId} />}
          {subTab === 'examens'      && tenantId && <SectionExamens      tenantId={tenantId} etudiants={etudiants} classes={classes} />}
          {subTab === 'attestations' && tenantId && <SectionAttestations tenantId={tenantId} etudiants={etudiants} nomEcole={nomEcole} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
