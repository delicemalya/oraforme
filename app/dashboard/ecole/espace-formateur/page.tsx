'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Clock, DollarSign, FileText, Plus, Trash2, Check,
  X, Loader2, ChevronRight, ClipboardList, GraduationCap,
  Upload, Video, BookMarked, AlertCircle, CheckCircle,
  Calendar, Users2, BarChart3, Layers,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  type Enseignant, type ClasseEcole, type Exam, type ExamGrade,
  TYPES_EXAM, fmt, Avatar, FI, KpiCard,
} from '../_lib/shared'
import { useLocale } from '@/lib/hooks/useLocale'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TeacherHour {
  id: string; enseignant_id: string; tenant_id: string
  heures: number; matiere: string | null; date_declaration: string
  periode: string | null; description: string | null
  statut: 'declare' | 'validated' | 'paye'; created_at: string
}

interface CoursNumerique {
  id: string; enseignant_id: string; tenant_id: string
  titre: string; description: string | null; matiere: string | null
  niveau: string | null; statut: 'brouillon' | 'publie'; created_at: string
}

interface Devoir {
  id: string; enseignant_id: string; tenant_id: string
  titre: string; description: string | null; matiere: string | null
  classe: string | null; date_remise: string | null
  statut: 'ouvert' | 'cloture'; created_at: string
}

interface BulletinPaie {
  id: string; employe_id: string; mois: number; annee: number
  brut: number; net: number; statut: string; created_at: string
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'cours' | 'devoirs' | 'examens' | 'heures' | 'paiements'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3     },
  { id: 'cours',     label: 'Cours & Supports', icon: Video        },
  { id: 'devoirs',   label: 'Devoirs',          icon: ClipboardList },
  { id: 'examens',   label: 'Examens & Notes',  icon: GraduationCap },
  { id: 'heures',    label: 'Mes Heures',       icon: Clock        },
  { id: 'paiements', label: 'Paiements',        icon: DollarSign   },
]

const STATUT_HEURE: Record<TeacherHour['statut'], { label: string; color: string; bg: string }> = {
  declare:   { label: 'Déclaré',  color: '#DC2626', bg: '#DC262618' },
  validated: { label: 'Validé',   color: '#DC2626', bg: '#DC262618' },
  paye:      { label: 'Payé',     color: '#0F172A', bg: '#0F172A18' },
}

// ── Small badge ───────────────────────────────────────────────────────────────

function Badge({ statut }: { statut: string }) {
  const cfg = STATUT_HEURE[statut as TeacherHour['statut']] ?? { label: statut, color: '#64748B', bg: '#64748B18' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer) }, [onClose])
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white"
      style={{ background: '#0F172A' }}>
      <CheckCircle size={15} />{msg}
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EspaceFormateurPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t } = useLocale()
  const [tab,         setTab]        = useState<Tab>('dashboard')
  const [enseignant,  setEnseignant] = useState<Enseignant | null>(null)
  const [classes,     setClasses]    = useState<ClasseEcole[]>([])
  const [heures,      setHeures]     = useState<TeacherHour[]>([])
  const [cours,       setCours]      = useState<CoursNumerique[]>([])
  const [devoirs,     setDevoirs]    = useState<Devoir[]>([])
  const [exams,       setExams]      = useState<Exam[]>([])
  const [bulletins,   setBulletins]  = useState<BulletinPaie[]>([])
  const [toast,       setToast]      = useState<string | null>(null)
  const [loading,     setLoading]    = useState(true)

  const showToast = (m: string) => setToast(m)

  // Identify current formateur by user_id (primary) or email (fallback)
  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Try user_id first (requires user_id column in enseignants)
    let ensQuery = await supabase
      .from('enseignants')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle()

    // Fallback: match by email
    if (!ensQuery.data && user.email) {
      ensQuery = await supabase
        .from('enseignants')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('email', user.email)
        .maybeSingle()
    }

    const { data: ens } = ensQuery

    setEnseignant(ens as Enseignant | null)

    const [clRes, hRes, cRes, dRes, eRes] = await Promise.all([
      supabase.from('classes_ecole').select('*').eq('tenant_id', tenantId).limit(200),
      ens
        ? supabase.from('teacher_hours').select('*').eq('tenant_id', tenantId).eq('enseignant_id', ens.id).order('date_declaration', { ascending: false }).limit(200)
        : { data: [] },
      ens
        ? supabase.from('cours_numeriques').select('*').eq('tenant_id', tenantId).eq('enseignant_id', ens.id).order('created_at', { ascending: false }).limit(200)
        : { data: [] },
      ens
        ? supabase.from('devoirs').select('*').eq('tenant_id', tenantId).eq('enseignant_id', ens.id).order('created_at', { ascending: false }).limit(200)
        : { data: [] },
      ens
        ? supabase.from('exams').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200)
        : { data: [] },
    ])

    setClasses((clRes.data ?? []) as ClasseEcole[])
    setHeures((hRes.data ?? []) as TeacherHour[])
    setCours((cRes.data ?? []) as CoursNumerique[])
    setDevoirs((dRes.data ?? []) as Devoir[])
    setExams((eRes.data ?? []) as Exam[])

    // Bulletins: match by enseignant email as employe identifier
    if (ens) {
      const { data: emp } = await supabase.from('employes').select('id').eq('tenant_id', tenantId).ilike('email', ens.email ?? '').maybeSingle()
      if (emp) {
        const { data: buls } = await supabase.from('bulletins_paie').select('*').eq('tenant_id', tenantId).eq('employe_id', emp.id).order('annee', { ascending: false }).order('mois', { ascending: false }).limit(200)
        setBulletins((buls ?? []) as BulletinPaie[])
      }
    }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const totalHeures    = heures.reduce((s, h) => s + h.heures, 0)
  const valideeHeures  = heures.filter(h => h.statut !== 'declare').reduce((s, h) => s + h.heures, 0)
  const payeeHeures    = heures.filter(h => h.statut === 'paye').reduce((s, h) => s + h.heures, 0)
  const totalNet       = bulletins.reduce((s, b) => s + b.net, 0)

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> {t('common.loading')}
      </div>
    )
  }

  if (!enseignant) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <AlertCircle size={32} className="text-[#DC2626]" />
        <p className="text-[#101729] font-semibold">Profil formateur non trouvé</p>
        <p className="text-[var(--text-secondary)] text-sm max-w-sm">
          Votre adresse email n&apos;est pas liée à un formateur dans cette école.<br/>
          Contactez l&apos;administration.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar nom={enseignant.nom} prenom={enseignant.prenom} photoUrl={null} size={40} />
          <div>
            <h1 className="text-xl font-bold text-[#101729]">{enseignant.prenom} {enseignant.nom}</h1>
            <p className="text-xs text-[var(--text-secondary)]">{enseignant.matiere ?? 'Formateur'} · Espace Personnel</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-[var(--border)] hover:bg-gray-100 text-[var(--text-secondary)] hover:text-[#101729] transition-colors">
          <Loader2 size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-[var(--border)]" style={{ background: '#FFFFFF' }}>
        {TABS.map(tab_ => {
          const Icon = tab_.icon
          const active = tab === tab_.id
          return (
            <button key={tab_.id} onClick={() => setTab(tab_.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${active ? 'text-white shadow' : 'text-[var(--text-secondary)] hover:text-[#101729]'}`}
              style={active ? { background: '#00b9a7' } : {}}>
              <Icon size={12} />{tab_.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'dashboard'  && <TabDashboard enseignant={enseignant} totalHeures={totalHeures} valideeHeures={valideeHeures} payeeHeures={payeeHeures} totalNet={totalNet} nbCours={cours.length} nbDevoirs={devoirs.length} heures={heures} />}
          {tab === 'cours'      && <TabCours tenantId={tenantId!} enseignant={enseignant} cours={cours} onRefresh={load} showToast={showToast} />}
          {tab === 'devoirs'    && <TabDevoirs tenantId={tenantId!} enseignant={enseignant} devoirs={devoirs} classes={classes} onRefresh={load} showToast={showToast} />}
          {tab === 'examens'    && <TabExamens tenantId={tenantId!} enseignant={enseignant} exams={exams} classes={classes} onRefresh={load} showToast={showToast} />}
          {tab === 'heures'     && <TabHeures tenantId={tenantId!} enseignant={enseignant} heures={heures} onRefresh={load} showToast={showToast} />}
          {tab === 'paiements'  && <TabPaiements bulletins={bulletins} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ── Tab Dashboard ─────────────────────────────────────────────────────────────

function TabDashboard({ enseignant, totalHeures, valideeHeures, payeeHeures, totalNet, nbCours, nbDevoirs, heures }: {
  enseignant: Enseignant; totalHeures: number; valideeHeures: number; payeeHeures: number
  totalNet: number; nbCours: number; nbDevoirs: number; heures: TeacherHour[]
}) {
  const kpis = [
    { label: 'Heures déclarées', value: totalHeures,   color: '#DC2626', sub: `${valideeHeures}h validées` },
    { label: 'Heures payées',    value: payeeHeures,   color: '#0F172A', sub: `sur ${totalHeures}h total` },
    { label: 'Cours publiés',    value: nbCours,       color: '#7C3AED', sub: 'cours numériques' },
    { label: 'Devoirs actifs',   value: nbDevoirs,     color: '#DC2626', sub: 'en cours' },
    { label: 'Net cumulé',       value: `${fmt(totalNet)} FCFA`, color: '#7C3AED', sub: 'tous bulletins' },
  ]

  const pending = heures.filter(h => h.statut === 'declare')

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-3">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} color={k.color} />)}
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-[#DC2626]/30 p-4" style={{ background: 'rgba(240,163,10,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-[#DC2626]" />
            <p className="text-xs font-bold text-[#DC2626] uppercase tracking-wider">{pending.length} déclaration{pending.length > 1 ? 's' : ''} en attente de validation</p>
          </div>
          <div className="space-y-2">
            {pending.slice(0, 5).map(h => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-[#101729]">{h.matiere ?? 'Non précisé'} · {h.heures}h</span>
                <span className="text-[var(--text-secondary)]">{new Date(h.date_declaration).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] p-4" style={{ background: '#FFFFFF' }}>
        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Résumé des heures</p>
        <div className="space-y-2">
          {[
            { label: 'Déclarées', value: heures.filter(h => h.statut === 'declare').reduce((s, h) => s + h.heures, 0), color: '#DC2626' },
            { label: 'Validées',  value: heures.filter(h => h.statut === 'validated').reduce((s, h) => s + h.heures, 0), color: '#DC2626' },
            { label: 'Payées',    value: heures.filter(h => h.statut === 'paye').reduce((s, h) => s + h.heures, 0), color: '#0F172A' },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="w-20 text-[10px] text-[var(--text-secondary)]">{row.label}</div>
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, totalHeures > 0 ? (row.value / totalHeures) * 100 : 0)}%`, background: row.color }} />
              </div>
              <div className="text-xs font-bold text-[#101729] w-10 text-right">{row.value}h</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab Cours numériques ──────────────────────────────────────────────────────

function TabCours({ tenantId, enseignant, cours, onRefresh, showToast }: {
  tenantId: string; enseignant: Enseignant; cours: CoursNumerique[]
  onRefresh: () => void; showToast: (m: string) => void
}) {
  const { t } = useLocale()
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ titre: '', description: '', matiere: enseignant.matiere ?? '', niveau: '', statut: 'brouillon' as 'brouillon' | 'publie' })

  async function save() {
    if (!form.titre.trim()) return
    setSaving(true)
    const { error } = await supabase.from('cours_numeriques').insert({
      tenant_id: tenantId, enseignant_id: enseignant.id,
      titre: form.titre.trim(), description: form.description || null,
      matiere: form.matiere || null, niveau: form.niveau || null,
      statut: form.statut,
    })
    if (error) { showToast('Erreur : table cours_numeriques non trouvée, contactez l\'admin'); setSaving(false); return }
    setForm({ titre: '', description: '', matiere: enseignant.matiere ?? '', niveau: '', statut: 'brouillon' })
    setShowForm(false); onRefresh()
    showToast(`Cours "${form.titre}" créé`)
    setSaving(false)
  }

  async function toggleStatut(c: CoursNumerique) {
    const next = c.statut === 'publie' ? 'brouillon' : 'publie'
    await supabase.from('cours_numeriques').update({ statut: next }).eq('id', c.id)
    onRefresh()
  }

  async function del(id: string) {
    await supabase.from('cours_numeriques').delete().eq('id', id)
    onRefresh(); showToast('Cours supprimé')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#101729]">Cours numériques ({cours.length})</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#00b9a7', color: '#fff' }}>
          <Plus size={12} /> Nouveau cours
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-[#DC2626]/30 p-4 space-y-3" style={{ background: 'rgba(56,139,253,0.06)' }}>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Titre du cours *" value={form.titre} onChange={v => setForm(p => ({ ...p, titre: v }))} />
              <FI label="Matière" value={form.matiere} onChange={v => setForm(p => ({ ...p, matiere: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Niveau (ex: Licence 2)" value={form.niveau} onChange={v => setForm(p => ({ ...p, niveau: v }))} />
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('common.status')}</label>
                <select value={form.statut} onChange={e => setForm(p => ({ ...p, statut: e.target.value as 'brouillon'|'publie' }))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="brouillon">{t('common.draft')}</option>
                  <option value="publie">Publié</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('common.description')}</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[#101729] focus:outline-none focus:border-[#00b9a7] resize-none" placeholder="Contenu, objectifs, plan…" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[#101729] border border-[var(--border)] hover:border-[#00b9a7]/40">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving || !form.titre.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ background: '#00b9a7', color: '#fff' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Créer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {cours.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-secondary)]">
            <Video size={24} className="mb-2 opacity-30" /><p className="text-xs">Aucun cours créé</p>
          </div>
        ) : cours.map(c => (
          <motion.div key={c.id} layout className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[#00b9a7]/30 transition-colors group" style={{ background: '#FFFFFF' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.statut === 'publie' ? '#7C3AED' : '#F3F4F6' }}>
              <BookOpen size={14} className={c.statut === 'publie' ? 'text-white' : 'text-[#7C3AED]'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#101729] truncate">{c.titre}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">{c.matiere ?? '—'} {c.niveau ? `· ${c.niveau}` : ''}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.statut === 'publie' ? 'bg-[var(--surface)]/20 text-[#DC2626]' : 'bg-gray-100 text-[var(--text-secondary)]'}`}>
              {c.statut === 'publie' ? 'Publié' : 'Brouillon'}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggleStatut(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-[var(--text-secondary)] hover:text-[#101729]"><Check size={12} /></button>
              <button onClick={() => del(c.id)} className="p-1.5 rounded-lg hover:bg-[#DC2626]/10 text-[var(--text-secondary)] hover:text-[#DC2626]"><Trash2 size={12} /></button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Tab Devoirs ───────────────────────────────────────────────────────────────

function TabDevoirs({ tenantId, enseignant, devoirs, classes, onRefresh, showToast }: {
  tenantId: string; enseignant: Enseignant; devoirs: Devoir[]
  classes: ClasseEcole[]; onRefresh: () => void; showToast: (m: string) => void
}) {
  const { t } = useLocale()
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ titre: '', description: '', matiere: enseignant.matiere ?? '', classe: '', date_remise: '' })

  async function save() {
    if (!form.titre.trim()) return
    setSaving(true)
    const { error } = await supabase.from('devoirs').insert({
      tenant_id: tenantId, enseignant_id: enseignant.id,
      titre: form.titre.trim(), description: form.description || null,
      matiere: form.matiere || null, classe: form.classe || null,
      date_remise: form.date_remise || null, statut: 'ouvert',
    })
    if (error) { showToast('Erreur : contactez l\'administrateur'); setSaving(false); return }
    setForm({ titre: '', description: '', matiere: enseignant.matiere ?? '', classe: '', date_remise: '' })
    setShowForm(false); onRefresh()
    showToast(`Devoir "${form.titre}" créé`)
    setSaving(false)
  }

  async function cloture(id: string) {
    await supabase.from('devoirs').update({ statut: 'cloture' }).eq('id', id)
    onRefresh(); showToast('Devoir clôturé')
  }

  async function del(id: string) {
    await supabase.from('devoirs').delete().eq('id', id)
    onRefresh(); showToast('Devoir supprimé')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#101729]">Devoirs ({devoirs.length})</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#DC2626', color: '#fff' }}>
          <Plus size={12} /> Nouveau devoir
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-[#DC2626]/30 p-4 space-y-3" style={{ background: 'rgba(240,163,10,0.06)' }}>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Titre du devoir *" value={form.titre} onChange={v => setForm(p => ({ ...p, titre: v }))} />
              <FI label="Matière" value={form.matiere} onChange={v => setForm(p => ({ ...p, matiere: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Classe</label>
                <select value={form.classe} onChange={e => setForm(p => ({ ...p, classe: e.target.value }))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">Toutes les classes</option>
                  {classes.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                </select>
              </div>
              <FI label="Date de remise" value={form.date_remise} onChange={v => setForm(p => ({ ...p, date_remise: v }))} type="date" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Consignes</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[#101729] focus:outline-none focus:border-[#00b9a7] resize-none" placeholder="Instructions détaillées…" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[#101729] border border-[var(--border)]">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving || !form.titre.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ background: '#DC2626', color: '#fff' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Créer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {devoirs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-secondary)]">
            <ClipboardList size={24} className="mb-2 opacity-30" /><p className="text-xs">Aucun devoir créé</p>
          </div>
        ) : devoirs.map(d => (
          <motion.div key={d.id} layout className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[#00b9a7]/30 group" style={{ background: '#FFFFFF' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: d.statut === 'ouvert' ? '#DC2626' : '#F3F4F6' }}>
              <ClipboardList size={14} className={d.statut === 'ouvert' ? 'text-white' : 'text-[#DC2626]'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#101729] truncate">{d.titre}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">{d.matiere ?? '—'} {d.classe ? `· ${d.classe}` : ''} {d.date_remise ? `· Remise: ${new Date(d.date_remise).toLocaleDateString('fr-FR')}` : ''}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.statut === 'ouvert' ? 'bg-[#DC2626]/20 text-[#DC2626]' : 'bg-gray-100 text-[var(--text-secondary)]'}`}>
              {d.statut === 'ouvert' ? 'Ouvert' : 'Clôturé'}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {d.statut === 'ouvert' && <button onClick={() => cloture(d.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-[var(--text-secondary)] hover:text-[#101729]"><Check size={12} /></button>}
              <button onClick={() => del(d.id)} className="p-1.5 rounded-lg hover:bg-[#DC2626]/10 text-[var(--text-secondary)] hover:text-[#DC2626]"><Trash2 size={12} /></button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Tab Examens & Notes ───────────────────────────────────────────────────────

function TabExamens({ tenantId, enseignant, exams, classes, onRefresh, showToast }: {
  tenantId: string; enseignant: Enseignant; exams: Exam[]
  classes: ClasseEcole[]; onRefresh: () => void; showToast: (m: string) => void
}) {
  const { t } = useLocale()
  const [showForm,   setShowForm]  = useState(false)
  const [saving,     setSaving]    = useState(false)
  const [selectedEx, setSelectedEx]= useState<Exam | null>(null)
  const [grades,     setGrades]    = useState<(ExamGrade & { nom?: string; prenom?: string })[]>([])
  const [etudiants,  setEtudiants] = useState<{ id: string; nom: string; prenom: string; classe: string | null }[]>([])
  const [loadingG,   setLoadingG]  = useState(false)
  const [form, setForm] = useState({ nom: '', type_exam: 'devoir' as Exam['type_exam'], matiere: enseignant.matiere ?? '', classe_id: '', date_exam: '', note_max: '20', coefficient: '1' })

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    await supabase.from('exams').insert({
      tenant_id: tenantId, nom: form.nom.trim(), type_exam: form.type_exam,
      classe_id: form.classe_id || null, date_exam: form.date_exam || null,
      note_max: Number(form.note_max), coefficient: Number(form.coefficient),
    })
    setForm({ nom: '', type_exam: 'devoir', matiere: enseignant.matiere ?? '', classe_id: '', date_exam: '', note_max: '20', coefficient: '1' })
    setShowForm(false); onRefresh(); showToast('Examen créé')
    setSaving(false)
  }

  async function openGrades(exam: Exam) {
    setSelectedEx(exam); setLoadingG(true)
    const classeId = exam.classe_id
    const [{ data: g }, { data: e }] = await Promise.all([
      supabase.from('exam_grades').select('*').eq('exam_id', exam.id),
      classeId
        ? supabase.from('etudiants').select('id, nom, prenom, classe').eq('tenant_id', tenantId).eq('classe', classes.find(c => c.id === classeId)?.nom ?? '')
        : supabase.from('etudiants').select('id, nom, prenom, classe').eq('tenant_id', tenantId).limit(100),
    ])
    const gradesList = (g ?? []) as ExamGrade[]
    const etudiantsData = (e ?? []) as { id: string; nom: string; prenom: string; classe: string | null }[]
    setEtudiants(etudiantsData)
    const enriched = etudiantsData.map(etu => {
      const gr = gradesList.find(g => g.etudiant_id === etu.id)
      return gr ? { ...gr, nom: etu.nom, prenom: etu.prenom } : { id: '', exam_id: exam.id, etudiant_id: etu.id, note: null, absent: false, commentaire: null, created_at: '', nom: etu.nom, prenom: etu.prenom }
    })
    setGrades(enriched)
    setLoadingG(false)
  }

  async function saveGrade(etudiantId: string, note: number | null, absent: boolean) {
    if (!selectedEx) return
    const existing = grades.find(g => g.etudiant_id === etudiantId)
    if (existing?.id) {
      await supabase.from('exam_grades').update({ note, absent }).eq('id', existing.id)
    } else {
      await supabase.from('exam_grades').insert({ exam_id: selectedEx.id, etudiant_id: etudiantId, note, absent })
    }
    setGrades(prev => prev.map(g => g.etudiant_id === etudiantId ? { ...g, note, absent } : g))
    showToast('Note enregistrée')
  }

  if (selectedEx) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedEx(null)} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[#101729]">
          <ChevronRight size={12} className="rotate-180" /> Retour aux examens
        </button>
        <div className="rounded-xl border border-[#00b9a7]/30 p-4" style={{ background: 'rgba(0,185,167,0.06)' }}>
          <p className="text-sm font-bold text-[#101729]">{selectedEx.nom}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{TYPES_EXAM.find(item => item.value === selectedEx.type_exam)?.label} · /{ selectedEx.note_max} pts · Coeff. {selectedEx.coefficient}</p>
        </div>
        {loadingG ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={18} /></div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2 px-3 py-1">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider col-span-2">Étudiant</p>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Note /{selectedEx.note_max}</p>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Absent</p>
            </div>
            {grades.map(g => (
              <div key={g.etudiant_id} className="grid grid-cols-4 gap-2 items-center p-3 rounded-xl border border-[var(--border)]" style={{ background: '#FFFFFF' }}>
                <p className="text-xs text-[#101729] col-span-2">{g.prenom} {g.nom}</p>
                <input
                  type="number" min={0} max={selectedEx.note_max}
                  value={g.note ?? ''} disabled={g.absent}
                  onChange={e => saveGrade(g.etudiant_id, e.target.value ? Number(e.target.value) : null, g.absent)}
                  className="w-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[#101729] focus:outline-none disabled:opacity-40"
                  placeholder="—"
                />
                <input type="checkbox" checked={g.absent} onChange={e => saveGrade(g.etudiant_id, g.absent ? null : g.note, e.target.checked)} className="w-4 h-4 accent-[#DC2626]" />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#101729]">Examens ({exams.length})</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#00b9a7', color: '#fff' }}>
          <Plus size={12} /> Nouvel examen
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-[#00b9a7]/30 p-4 space-y-3" style={{ background: 'rgba(0,185,167,0.06)' }}>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Nom de l'examen *" value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} />
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('common.type')}</label>
                <select value={form.type_exam} onChange={e => setForm(p => ({ ...p, type_exam: e.target.value as Exam['type_exam'] }))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  {TYPES_EXAM.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Classe</label>
                <select value={form.classe_id} onChange={e => setForm(p => ({ ...p, classe_id: e.target.value }))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                  <option value="">Toutes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <FI label="Note max" value={form.note_max} onChange={v => setForm(p => ({ ...p, note_max: v }))} type="number" />
              <FI label="Coefficient" value={form.coefficient} onChange={v => setForm(p => ({ ...p, coefficient: v }))} type="number" />
            </div>
            <FI label="Date de l'examen" value={form.date_exam} onChange={v => setForm(p => ({ ...p, date_exam: v }))} type="date" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving || !form.nom.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ background: '#00b9a7', color: '#fff' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Créer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-secondary)]">
            <GraduationCap size={24} className="mb-2 opacity-30" /><p className="text-xs">Aucun examen créé</p>
          </div>
        ) : exams.map(ex => (
          <motion.div key={ex.id} layout className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[#00b9a7]/30 group cursor-pointer" style={{ background: '#FFFFFF' }} onClick={() => openGrades(ex)}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#7C3AED' }}>
              <GraduationCap size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#101729] truncate">{ex.nom}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">{TYPES_EXAM.find(item => item.value === ex.type_exam)?.label} · /{ ex.note_max} pts · Coeff. {ex.coefficient}</p>
            </div>
            <ChevronRight size={14} className="text-[var(--text-secondary)] group-hover:text-[#00b9a7] transition-colors" />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Tab Heures ────────────────────────────────────────────────────────────────

function TabHeures({ tenantId, enseignant, heures, onRefresh, showToast }: {
  tenantId: string; enseignant: Enseignant; heures: TeacherHour[]
  onRefresh: () => void; showToast: (m: string) => void
}) {
  const { t } = useLocale()
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    heures: '', matiere: enseignant.matiere ?? '', date_declaration: new Date().toISOString().split('T')[0], periode: '', description: '',
  })

  async function save() {
    if (!form.heures || !form.date_declaration) return
    setSaving(true)
    await supabase.from('teacher_hours').insert({
      tenant_id: tenantId, enseignant_id: enseignant.id,
      heures: Number(form.heures), matiere: form.matiere || null,
      date_declaration: form.date_declaration, periode: form.periode || null,
      description: form.description || null, statut: 'declare',
    })
    setForm({ heures: '', matiere: enseignant.matiere ?? '', date_declaration: new Date().toISOString().split('T')[0], periode: '', description: '' })
    setShowForm(false); onRefresh()
    showToast(`${form.heures}h déclarées avec succès`)

    // Notify RH of new declaration
    try {
      await supabase.from('notifications').insert({
        tenant_id: tenantId,
        type: 'heures_formateur',
        titre: `Déclaration d'heures — ${enseignant.prenom} ${enseignant.nom}`,
        message: `${form.heures}h déclarées pour ${form.matiere || 'matière non précisée'} (${new Date(form.date_declaration).toLocaleDateString('fr-FR')})`,
        destinataire_role: 'RH_PAIE',
        read: false,
      })
    } catch {}

    setSaving(false)
  }

  async function del(id: string) {
    await supabase.from('teacher_hours').delete().eq('id', id)
    onRefresh(); showToast('Déclaration supprimée')
  }

  const byStatut = {
    declare:   heures.filter(h => h.statut === 'declare'),
    validated: heures.filter(h => h.statut === 'validated'),
    paye:      heures.filter(h => h.statut === 'paye'),
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'En attente',  value: `${byStatut.declare.reduce((s, h) => s + h.heures, 0)}h`,   color: '#DC2626', count: byStatut.declare.length },
          { label: 'Validées',   value: `${byStatut.validated.reduce((s, h) => s + h.heures, 0)}h`,  color: '#DC2626', count: byStatut.validated.length },
          { label: 'Payées',     value: `${byStatut.paye.reduce((s, h) => s + h.heures, 0)}h`,       color: '#0F172A', count: byStatut.paye.length },
        ].map(k => <KpiCard key={k.label} label={k.label} value={k.value} sub={`${k.count} déclaration${k.count > 1 ? 's' : ''}`} color={k.color} />)}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#101729]">Historique ({heures.length})</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#0F172A', color: '#fff' }}>
          <Plus size={12} /> Déclarer heures
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-[#0F172A]/30 p-4 space-y-3" style={{ background: 'rgba(46,160,67,0.06)' }}>
            <div className="grid grid-cols-3 gap-3">
              <FI label="Heures *" value={form.heures} onChange={v => setForm(p => ({ ...p, heures: v }))} type="number" />
              <FI label="Matière" value={form.matiere} onChange={v => setForm(p => ({ ...p, matiere: v }))} />
              <FI label="Date *" value={form.date_declaration} onChange={v => setForm(p => ({ ...p, date_declaration: v }))} type="date" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Période (ex: Semestre 1)" value={form.periode} onChange={v => setForm(p => ({ ...p, periode: v }))} />
              <FI label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving || !form.heures || !form.date_declaration} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ background: '#0F172A', color: '#fff' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Déclarer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {heures.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-secondary)]">
            <Clock size={24} className="mb-2 opacity-30" /><p className="text-xs">Aucune heure déclarée</p>
          </div>
        ) : heures.map(h => (
          <motion.div key={h.id} layout className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] group" style={{ background: '#FFFFFF' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${STATUT_HEURE[h.statut]?.color}20` }}>
              <Clock size={14} style={{ color: STATUT_HEURE[h.statut]?.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#101729]">{h.heures}h · {h.matiere ?? 'Non précisé'}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">{new Date(h.date_declaration).toLocaleDateString('fr-FR')} {h.periode ? `· ${h.periode}` : ''}</p>
            </div>
            <Badge statut={h.statut} />
            {h.statut === 'declare' && (
              <button onClick={() => del(h.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[#DC2626]/10 text-[var(--text-secondary)] hover:text-[#DC2626] transition-all">
                <Trash2 size={12} />
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Tab Paiements ─────────────────────────────────────────────────────────────

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function TabPaiements({ bulletins }: { bulletins: BulletinPaie[] }) {
  const totalNet   = bulletins.reduce((s, b) => s + b.net, 0)
  const totalBrut  = bulletins.reduce((s, b) => s + b.brut, 0)
  const nbPayes    = bulletins.filter(b => b.statut === 'payee').length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total net reçu"   value={`${fmt(totalNet)} FCFA`}  color="#0F172A" />
        <KpiCard label="Total brut"       value={`${fmt(totalBrut)} FCFA`} color="#DC2626" />
        <KpiCard label="Bulletins payés"  value={`${nbPayes}/${bulletins.length}`} color="#7C3AED" />
      </div>

      <div className="space-y-2">
        {bulletins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-secondary)]">
            <DollarSign size={24} className="mb-2 opacity-30" /><p className="text-xs">Aucun bulletin trouvé</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">Votre email doit être lié à un employé dans le module RH</p>
          </div>
        ) : bulletins.map(b => (
          <motion.div key={b.id} layout className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)]" style={{ background: '#FFFFFF' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: b.statut === 'payee' ? '#0F172A' : '#F3F4F6' }}>
              <DollarSign size={14} className={b.statut === 'payee' ? 'text-white' : 'text-[var(--text-secondary)]'} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#101729]">{MOIS[b.mois - 1]} {b.annee}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Brut : {fmt(b.brut)} · Net : {fmt(b.net)} FCFA</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.statut === 'payee' ? 'bg-[var(--surface)]/20 text-[#DC2626]' : b.statut === 'validee' ? 'bg-[#DC2626]/20 text-[#DC2626]' : 'bg-[#DC2626]/20 text-[#DC2626]'}`}>
              {b.statut === 'payee' ? 'Payé' : b.statut === 'validee' ? 'Validé' : 'Généré'}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
