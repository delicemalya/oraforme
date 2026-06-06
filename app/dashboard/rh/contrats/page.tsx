'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FileText, Plus, AlertTriangle, CheckCircle, Clock, X,
  Download, Eye, RefreshCw, Ban, ChevronLeft, Loader2,
  User, Building2, MapPin, Calendar, DollarSign, Edit2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type TypeContrat = 'cdi' | 'cdd' | 'stage' | 'freelance' | 'vacation' | 'apprentissage'
type StatutContrat = 'actif' | 'termine' | 'suspendu' | 'expire' | 'resilie' | 'brouillon'

interface Employe {
  id: string
  nom: string
  poste: string | null
  matricule: string | null
  email: string | null
  telephone: string | null
  photo_url: string | null
}

interface Contrat {
  id: string
  employe_id: string
  type_contrat: TypeContrat
  date_debut: string
  date_fin: string | null
  salaire_base: number
  primes: number
  periode_essai: number
  lieu_travail: string | null
  description: string | null
  statut: StatutContrat
  signe_le: string | null
  signe_employe: boolean
  signe_employeur: boolean
  avantages: Array<{ type: string; montant?: number; label: string }>
  notes: string | null
  created_at: string
  employes: Employe | null
}

interface EmployeBasic {
  id: string
  nom: string
  poste: string | null
  salaire_base: number
  contrat: string | null
}

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<TypeContrat, { label: string; color: string; bg: string }> = {
  cdi:          { label: 'CDI',          color: '#10B981', bg: '#D1FAE5' },
  cdd:          { label: 'CDD',          color: '#3B82F6', bg: '#DBEAFE' },
  stage:        { label: 'Stage',        color: '#F59E0B', bg: '#FEF3C7' },
  freelance:    { label: 'Freelance',    color: '#8B5CF6', bg: '#EDE9FE' },
  vacation:     { label: 'Vacation',     color: '#EC4899', bg: '#FCE7F3' },
  apprentissage:{ label: 'Apprentissage',color: '#64748B', bg: '#F1F5F9' },
}

const STATUT_CFG: Record<StatutContrat, { label: string; color: string; bg: string }> = {
  actif:     { label: 'Actif',     color: '#10B981', bg: '#D1FAE5' },
  termine:   { label: 'Terminé',   color: '#64748B', bg: '#F1F5F9' },
  suspendu:  { label: 'Suspendu',  color: '#F59E0B', bg: '#FEF3C7' },
  expire:    { label: 'Expiré',    color: '#EF4444', bg: '#FEE2E2' },
  resilie:   { label: 'Résilié',   color: '#DC2626', bg: '#FEF2F2' },
  brouillon: { label: 'Brouillon', color: '#94A3B8', bg: '#F8FAFC' },
}

const TYPES_AVEC_FIN: TypeContrat[] = ['cdd', 'stage', 'vacation', 'apprentissage']

// ── Utilitaires ───────────────────────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysLeft(dateStr?: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function initiales(nom: string) {
  return nom.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

const COLORS = ['#F59E0B','#3B82F6','#10B981','#8B5CF6','#EC4899','#EF4444']
function avatarColor(nom: string) { return COLORS[nom.charCodeAt(0) % COLORS.length] }

// ── Formulaire nouveau contrat ────────────────────────────────────────────────

const INIT_FORM = {
  employe_id:      '',
  type_contrat:    'cdi' as TypeContrat,
  date_debut:      new Date().toISOString().slice(0, 10),
  date_fin:        '',
  salaire_base:    '',
  primes:          '',
  periode_essai:   '0',
  lieu_travail:    '',
  description:     '',
  notes:           '',
  signe_le:        '',
  signe_employe:   false,
  signe_employeur: false,
  avantages: {
    logement:      '',
    transport:     '',
    restauration:  '',
    telephone:     '',
    assurance:     false,
    treizieme:     false,
    prime_rend:    false,
  },
}

type FormState = typeof INIT_FORM

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ContratsPage() {
  const [contrats,     setContrats]     = useState<Contrat[]>([])
  const [employes,     setEmployes]     = useState<EmployeBasic[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('tous')
  const [detail,       setDetail]       = useState<Contrat | null>(null)
  const [showNew,      setShowNew]      = useState(false)
  const [showRenew,    setShowRenew]    = useState<Contrat | null>(null)
  const [showTerminate,setShowTerminate]= useState<Contrat | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [pdfLoading,   setPdfLoading]   = useState<string | null>(null)
  const [form,         setForm]         = useState<FormState>(INIT_FORM)
  const [renewForm,    setRenewForm]    = useState({ type_contrat: 'cdi' as TypeContrat, date_debut: '', date_fin: '', salaire_base: '', motif: '' })
  const [termForm,     setTermForm]     = useState({ type_resiliation: 'demission', date_resiliation: new Date().toISOString().slice(0, 10), motif: '', preavis_jours: '30' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/hr/contracts')
    const json = await res.json() as { data?: Contrat[] }
    setContrats(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function loadEmployes() {
    if (employes.length > 0) return
    const res = await fetch('/api/hr/employees')
    const json = await res.json() as { data?: EmployeBasic[] }
    setEmployes(json.data ?? [])
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const expirantCount = useMemo(() =>
    contrats.filter(c => { const d = daysLeft(c.date_fin); return d !== null && d >= 0 && d <= 30 }).length
  , [contrats])

  const expireCount = useMemo(() =>
    contrats.filter(c => { const d = daysLeft(c.date_fin); return d !== null && d < 0 && c.statut === 'actif' }).length
  , [contrats])

  // ── Filtres ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => contrats.filter(c => {
    if (filter === 'tous') return true
    if (filter === 'expirant') { const d = daysLeft(c.date_fin); return d !== null && d >= 0 && d <= 30 }
    if (filter === 'expire')   { const d = daysLeft(c.date_fin); return d !== null && d < 0 && c.statut === 'actif' }
    return c.type_contrat === filter
  }), [contrats, filter])

  // ── Création ───────────────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function buildAvantages(av: FormState['avantages']) {
    const result: Array<{ type: string; montant?: number; label: string }> = []
    if (av.logement)     result.push({ type: 'logement',     montant: Number(av.logement),     label: 'Logement' })
    if (av.transport)    result.push({ type: 'transport',    montant: Number(av.transport),    label: 'Transport' })
    if (av.restauration) result.push({ type: 'restauration', montant: Number(av.restauration), label: 'Restauration' })
    if (av.telephone)    result.push({ type: 'telephone',    montant: Number(av.telephone),    label: 'Téléphone' })
    if (av.assurance)    result.push({ type: 'assurance',    label: 'Assurance maladie' })
    if (av.treizieme)    result.push({ type: 'prime',        label: '13ème mois' })
    if (av.prime_rend)   result.push({ type: 'prime',        label: 'Prime de rendement' })
    return result
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employe_id) return alert('Sélectionnez un employé')
    if (!form.salaire_base) return alert('Saisissez le salaire brut')
    setSaving(true)
    const res = await fetch('/api/hr/contracts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employe_id:      form.employe_id,
        type_contrat:    form.type_contrat,
        date_debut:      form.date_debut,
        date_fin:        form.date_fin || null,
        salaire_base:    Number(form.salaire_base),
        primes:          Number(form.primes) || 0,
        periode_essai:   Number(form.periode_essai) || 0,
        lieu_travail:    form.lieu_travail || null,
        description:     form.description || null,
        notes:           form.notes || null,
        signe_le:        form.signe_le || null,
        signe_employe:   form.signe_employe,
        signe_employeur: form.signe_employeur,
        avantages:       buildAvantages(form.avantages),
        statut:          'actif',
      }),
    })
    const json = await res.json() as { success?: boolean; error?: string }
    setSaving(false)
    if (!json.success) return alert('Erreur : ' + json.error)
    setShowNew(false)
    setForm(INIT_FORM)
    load()
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  async function handlePDF(c: Contrat) {
    setPdfLoading(c.id)
    try {
      const res = await fetch(`/api/hr/contracts/${c.id}/pdf`)
      if (!res.ok) { alert('Erreur PDF'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `contrat-${c.employes?.nom ?? c.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPdfLoading(null)
    }
  }

  // ── Renouvellement ────────────────────────────────────────────────────────

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault()
    if (!showRenew) return
    setSaving(true)
    const res = await fetch(`/api/hr/contracts/${showRenew.id}/renew`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type_contrat: renewForm.type_contrat,
        date_debut:   renewForm.date_debut || new Date().toISOString().slice(0, 10),
        date_fin:     renewForm.date_fin || null,
        salaire_base: renewForm.salaire_base ? Number(renewForm.salaire_base) : undefined,
        motif:        renewForm.motif || undefined,
      }),
    })
    const json = await res.json() as { success?: boolean; error?: string }
    setSaving(false)
    if (!json.success) return alert('Erreur : ' + json.error)
    setShowRenew(null)
    setDetail(null)
    load()
  }

  // ── Résiliation ───────────────────────────────────────────────────────────

  async function handleTerminate(e: React.FormEvent) {
    e.preventDefault()
    if (!showTerminate) return
    setSaving(true)
    const res = await fetch(`/api/hr/contracts/${showTerminate.id}/terminate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type_resiliation:  termForm.type_resiliation,
        date_resiliation:  termForm.date_resiliation,
        motif:             termForm.motif || undefined,
        preavis_jours:     Number(termForm.preavis_jours) || 0,
      }),
    })
    const json = await res.json() as { success?: boolean; error?: string }
    setSaving(false)
    if (!json.success) return alert('Erreur : ' + json.error)
    setShowTerminate(null)
    setDetail(null)
    load()
  }

  // ── Net estimé (récap en temps réel) ─────────────────────────────────────

  const brut     = Number(form.salaire_base) || 0
  const cnssEmp  = Math.round(brut * 0.0504)
  const netEst   = brut - cnssEmp
  const coutPat  = Math.round(brut * 1.1416)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center">
            <FileText size={18} className="text-[#F59E0B]" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Contrats</h1>
            <p className="text-[11px] text-[#64748B]">
              {contrats.length} contrat{contrats.length !== 1 ? 's' : ''} ·{' '}
              {expirantCount > 0 && <span className="text-amber-600 font-semibold">{expirantCount} expirant · </span>}
              {expireCount > 0   && <span className="text-red-600 font-semibold">{expireCount} expiré{expireCount !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowNew(true); loadEmployes() }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold
            hover:bg-[#D97706] transition-colors shadow-sm"
        >
          <Plus size={15} /> Nouveau contrat
        </button>
      </div>

      {/* ── Alertes ────────────────────────────────────────────────────────── */}
      {expireCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-[13px] font-semibold text-red-700">
            {expireCount} contrat{expireCount !== 1 ? 's' : ''} CDD/Stage expiré{expireCount !== 1 ? 's' : ''} — action requise
          </p>
          <button onClick={() => setFilter('expire')} className="ml-auto text-[11px] text-red-600 font-bold hover:underline">
            Voir →
          </button>
        </div>
      )}
      {expirantCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Clock size={15} className="text-amber-600 shrink-0" />
          <p className="text-[13px] font-semibold text-amber-700">
            {expirantCount} contrat{expirantCount !== 1 ? 's' : ''} expirant dans moins de 30 jours
          </p>
          <button onClick={() => setFilter('expirant')} className="ml-auto text-[11px] text-amber-600 font-bold hover:underline">
            Voir →
          </button>
        </div>
      )}

      {/* ── Filtres ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { id: 'tous',         label: `Tous (${contrats.length})` },
          { id: 'cdi',          label: 'CDI' },
          { id: 'cdd',          label: 'CDD' },
          { id: 'stage',        label: 'Stage' },
          { id: 'vacation',     label: 'Vacation' },
          { id: 'freelance',    label: 'Freelance' },
          { id: 'expirant',     label: `Expirant (${expirantCount})`, warn: expirantCount > 0 },
          { id: 'expire',       label: `Expirés (${expireCount})`,    warn: expireCount > 0 },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
              filter === f.id
                ? 'bg-[#F59E0B] text-white'
                : f.warn
                  ? 'border border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                  : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Tableau ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#F1F5F9] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  {['Employé', 'Type contrat', 'Début', 'Fin / Échéance', 'Salaire brut', 'Statut', 'Signatures', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filtered.map(c => {
                  const emp    = c.employes
                  const tcfg   = TYPE_CFG[c.type_contrat] ?? TYPE_CFG.cdi
                  const scfg   = STATUT_CFG[c.statut] ?? STATUT_CFG.actif
                  const days   = daysLeft(c.date_fin)
                  const isExp  = days !== null && days < 0 && c.statut === 'actif'
                  const isWarn = days !== null && days >= 0 && days <= 30
                  const isCDI  = c.type_contrat === 'cdi'

                  return (
                    <tr key={c.id}
                      className="hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                      onClick={() => setDetail(c)}
                    >
                      {/* Employé */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                            style={{ backgroundColor: avatarColor(emp?.nom ?? 'A') }}>
                            {initiales(emp?.nom ?? '?')}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#0F172A]">{emp?.nom ?? '—'}</p>
                            <p className="text-[10px] text-[#94A3B8]">{emp?.poste ?? '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                          style={{ color: tcfg.color, backgroundColor: tcfg.bg }}>
                          {tcfg.label}
                        </span>
                      </td>

                      {/* Début */}
                      <td className="px-4 py-3 text-[12px] text-[#64748B]">{fmtDate(c.date_debut)}</td>

                      {/* Fin */}
                      <td className="px-4 py-3">
                        {isCDI ? (
                          <span className="text-[11px] text-[#94A3B8] italic">Indéterminée</span>
                        ) : (
                          <div>
                            <p className={`text-[12px] font-semibold ${isExp ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-[#0F172A]'}`}>
                              {fmtDate(c.date_fin)}
                            </p>
                            {days !== null && (
                              <p className={`text-[10px] ${isExp ? 'text-red-500' : isWarn ? 'text-amber-500' : 'text-[#94A3B8]'}`}>
                                {isExp ? `Expiré il y a ${Math.abs(days)}j` : `Dans ${days} jour${days > 1 ? 's' : ''}`}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Salaire */}
                      <td className="px-4 py-3 text-[12px] font-semibold text-[#0F172A]">{fmt(c.salaire_base)} FCFA</td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
                          style={{ color: scfg.color, backgroundColor: scfg.bg }}>
                          {c.statut === 'actif' && !isExp && !isWarn && <CheckCircle size={9} />}
                          {(isExp || c.statut === 'expire' || c.statut === 'resilie') && <AlertTriangle size={9} />}
                          {isWarn && <Clock size={9} />}
                          {isExp ? 'Expiré' : scfg.label}
                        </span>
                      </td>

                      {/* Signatures */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={c.signe_employe ? 'text-green-600' : 'text-[#CBD5E1]'} title="Employé">
                            👤{c.signe_employe ? '✓' : '⏳'}
                          </span>
                          <span className={c.signe_employeur ? 'text-green-600' : 'text-[#CBD5E1]'} title="Employeur">
                            🏢{c.signe_employeur ? '✓' : '⏳'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button title="Voir détails" onClick={() => setDetail(c)}
                            className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#0F172A] transition-colors">
                            <Eye size={13} />
                          </button>
                          <button
                            title={pdfLoading === c.id ? 'Génération...' : 'Télécharger PDF'}
                            onClick={() => handlePDF(c)}
                            disabled={pdfLoading === c.id}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-[#94A3B8] hover:text-blue-600 transition-colors disabled:opacity-40">
                            {pdfLoading === c.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Download size={13} />}
                          </button>
                          {TYPES_AVEC_FIN.includes(c.type_contrat) && c.statut === 'actif' && (
                            <button title="Renouveler" onClick={() => {
                              setRenewForm({ type_contrat: c.type_contrat, date_debut: new Date().toISOString().slice(0, 10), date_fin: '', salaire_base: String(c.salaire_base), motif: '' })
                              setShowRenew(c)
                            }}
                              className="p-1.5 rounded-lg hover:bg-green-50 text-[#94A3B8] hover:text-green-600 transition-colors">
                              <RefreshCw size={13} />
                            </button>
                          )}
                          {c.statut === 'actif' && (
                            <button title="Résilier" onClick={() => setShowTerminate(c)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-600 transition-colors">
                              <Ban size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <FileText size={32} className="mx-auto text-[#E2E8F0] mb-3" />
                      <p className="text-[13px] text-[#94A3B8]">Aucun contrat trouvé</p>
                      {filter === 'tous' && (
                        <button onClick={() => { setShowNew(true); loadEmployes() }}
                          className="mt-3 text-[12px] text-[#F59E0B] font-semibold hover:underline">
                          + Créer le premier contrat
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — DÉTAIL CONTRAT
      ═══════════════════════════════════════════════════════════════════════ */}
      {detail && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDetail(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-[#E2E8F0] z-50 overflow-y-auto shadow-2xl flex flex-col">

            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold"
                  style={{ backgroundColor: avatarColor(detail.employes?.nom ?? 'A') }}>
                  {initiales(detail.employes?.nom ?? '?')}
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-[#0F172A]">{detail.employes?.nom ?? '—'}</h2>
                  <p className="text-[11px] text-[#64748B]">{detail.employes?.poste ?? '—'}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
                <X size={16} className="text-[#64748B]" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Badge type */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => { const t = TYPE_CFG[detail.type_contrat]; return (
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full" style={{ color: t.color, backgroundColor: t.bg }}>{t.label}</span>
                )})()}
                {(() => { const s = STATUT_CFG[detail.statut]; return (
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>{s.label}</span>
                )})()}
              </div>

              {/* Infos */}
              <div className="space-y-2">
                {[
                  { icon: Calendar,   label: 'Date début',     val: fmtDate(detail.date_debut) },
                  { icon: Calendar,   label: 'Date fin',       val: detail.date_fin ? fmtDate(detail.date_fin) : 'Indéterminée' },
                  { icon: DollarSign, label: 'Salaire brut',   val: `${fmt(detail.salaire_base)} FCFA` },
                  { icon: DollarSign, label: 'Primes',         val: detail.primes ? `${fmt(detail.primes)} FCFA` : '—' },
                  { icon: User,       label: 'Période essai',  val: detail.periode_essai ? `${detail.periode_essai} mois` : 'Aucune' },
                  { icon: MapPin,     label: 'Lieu de travail',val: detail.lieu_travail ?? '—' },
                ].map(({ icon: Icon, label, val }) => (
                  <div key={label} className="flex items-center gap-3 bg-[#F8FAFC] rounded-xl px-3 py-2.5">
                    <Icon size={13} className="text-[#94A3B8] shrink-0" />
                    <span className="text-[11px] text-[#64748B] w-28 shrink-0">{label}</span>
                    <span className="text-[11px] font-semibold text-[#0F172A]">{val}</span>
                  </div>
                ))}
              </div>

              {/* Signatures */}
              <div className="bg-[#F8FAFC] rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Signatures</p>
                <div className="flex gap-4">
                  <div className={`flex items-center gap-2 text-[11px] font-semibold ${detail.signe_employe ? 'text-green-700' : 'text-[#94A3B8]'}`}>
                    <CheckCircle size={13} className={detail.signe_employe ? 'text-green-600' : 'text-[#CBD5E1]'} />
                    Employé {detail.signe_employe ? '✓' : '(en attente)'}
                  </div>
                  <div className={`flex items-center gap-2 text-[11px] font-semibold ${detail.signe_employeur ? 'text-green-700' : 'text-[#94A3B8]'}`}>
                    <Building2 size={13} className={detail.signe_employeur ? 'text-green-600' : 'text-[#CBD5E1]'} />
                    Employeur {detail.signe_employeur ? '✓' : '(en attente)'}
                  </div>
                </div>
                {detail.signe_le && (
                  <p className="text-[10px] text-[#94A3B8] mt-2">Signé le {fmtDate(detail.signe_le)}</p>
                )}
              </div>

              {/* Avantages */}
              {detail.avantages?.length > 0 && (
                <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider mb-2">Avantages</p>
                  <div className="space-y-1">
                    {detail.avantages.map((a, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-[#64748B]">{a.label}</span>
                        <span className="font-semibold text-[#0F172A]">{a.montant ? `${fmt(a.montant)} FCFA/mois` : '✓'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {detail.notes && (
                <div className="bg-[#F8FAFC] rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-[12px] text-[#374151]">{detail.notes}</p>
                </div>
              )}

              {/* Récap financier */}
              <div className="bg-[#F8FAFC] rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Récapitulatif financier</p>
                {[
                  ['Salaire brut',           `${fmt(detail.salaire_base)} FCFA`],
                  ['CNSS salarié (5,04%)',   `- ${fmt(Math.round(detail.salaire_base * 0.0504))} FCFA`],
                  ['Net estimé',             `${fmt(Math.round(detail.salaire_base * 0.9496))} FCFA`],
                  ['Coût employeur total',   `${fmt(Math.round(detail.salaire_base * 1.1416))} FCFA`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 text-[11px] border-b border-[#E2E8F0] last:border-0">
                    <span className="text-[#64748B]">{k}</span>
                    <span className="font-semibold text-[#0F172A]">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 border-t border-[#F1F5F9] p-4 space-y-2">
              <button onClick={() => handlePDF(detail)} disabled={pdfLoading === detail.id}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-50 border border-blue-200
                  text-blue-700 rounded-xl text-[12px] font-semibold hover:bg-blue-100 transition-colors disabled:opacity-40">
                {pdfLoading === detail.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Télécharger le PDF
              </button>
              {TYPES_AVEC_FIN.includes(detail.type_contrat) && detail.statut === 'actif' && (
                <button onClick={() => {
                  setRenewForm({ type_contrat: detail.type_contrat, date_debut: new Date().toISOString().slice(0, 10), date_fin: '', salaire_base: String(detail.salaire_base), motif: '' })
                  setShowRenew(detail)
                }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-50 border border-green-200
                    text-green-700 rounded-xl text-[12px] font-semibold hover:bg-green-100 transition-colors">
                  <RefreshCw size={13} /> Renouveler le contrat
                </button>
              )}
              {detail.statut === 'actif' && (
                <button onClick={() => setShowTerminate(detail)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 border border-red-200
                    text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100 transition-colors">
                  <Ban size={13} /> Résilier le contrat
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — NOUVEAU CONTRAT
      ═══════════════════════════════════════════════════════════════════════ */}
      {showNew && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowNew(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white z-50 overflow-y-auto shadow-2xl flex flex-col">

            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9] bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowNew(false)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg">
                  <ChevronLeft size={16} className="text-[#64748B]" />
                </button>
                <div>
                  <h2 className="text-[16px] font-bold text-[#0F172A]">Nouveau contrat</h2>
                  <p className="text-[11px] text-[#64748B]">Créer un contrat de travail</p>
                </div>
              </div>
              <button onClick={() => setShowNew(false)}><X size={16} className="text-[#64748B]" /></button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

              {/* SECTION 1 — Employé */}
              <SectionTitle icon={User} title="Section 1 — Employé" />
              <div>
                <label className="field-label">Sélectionner un employé *</label>
                <select value={form.employe_id} onChange={e => setField('employe_id', e.target.value)}
                  className="field-input" required>
                  <option value="">— Choisir un employé —</option>
                  {employes.map(e => (
                    <option key={e.id} value={e.id}>{e.nom}{e.poste ? ` · ${e.poste}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* SECTION 2 — Type & Durée */}
              <SectionTitle icon={Calendar} title="Section 2 — Type & Durée" />

              <div>
                <label className="field-label">Type de contrat *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(TYPE_CFG) as [TypeContrat, typeof TYPE_CFG[TypeContrat]][]).map(([k, v]) => (
                    <button type="button" key={k}
                      onClick={() => setField('type_contrat', k)}
                      className={`py-2.5 px-3 rounded-xl text-[12px] font-semibold border transition-all ${
                        form.type_contrat === k
                          ? 'border-[#F59E0B] bg-[#FFFBEB] text-[#92400E]'
                          : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                      }`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Date de début *</label>
                  <input type="date" value={form.date_debut} onChange={e => setField('date_debut', e.target.value)}
                    className="field-input" required />
                </div>
                {TYPES_AVEC_FIN.includes(form.type_contrat) && (
                  <div>
                    <label className="field-label">Date de fin *</label>
                    <input type="date" value={form.date_fin} onChange={e => setField('date_fin', e.target.value)}
                      className="field-input" required />
                  </div>
                )}
                <div>
                  <label className="field-label">Période d&apos;essai (mois)</label>
                  <input type="number" min={0} max={6} value={form.periode_essai}
                    onChange={e => setField('periode_essai', e.target.value)} className="field-input" />
                </div>
              </div>

              {/* SECTION 3 — Poste & Rémunération */}
              <SectionTitle icon={DollarSign} title="Section 3 — Poste & Rémunération" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Lieu de travail</label>
                  <input type="text" value={form.lieu_travail} placeholder="Brazzaville, siège social..."
                    onChange={e => setField('lieu_travail', e.target.value)} className="field-input" />
                </div>
              </div>

              <div>
                <label className="field-label">Salaire brut mensuel (FCFA) *</label>
                <input type="number" min={0} value={form.salaire_base} placeholder="ex: 500000"
                  onChange={e => setField('salaire_base', e.target.value)} className="field-input-lg" required />
              </div>

              <div>
                <label className="field-label">Primes mensuelles (FCFA)</label>
                <input type="number" min={0} value={form.primes} placeholder="0"
                  onChange={e => setField('primes', e.target.value)} className="field-input" />
              </div>

              {/* Avantages */}
              <div>
                <label className="field-label">Avantages</label>
                <div className="space-y-2">
                  {([
                    { key: 'logement',     label: 'Logement',     hasAmount: true },
                    { key: 'transport',    label: 'Transport',    hasAmount: true },
                    { key: 'restauration', label: 'Restauration', hasAmount: true },
                    { key: 'telephone',    label: 'Téléphone',    hasAmount: true },
                  ] as const).map(av => (
                    <div key={av.key} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-[12px] text-[#374151] cursor-pointer select-none min-w-[120px]">
                        <input type="checkbox"
                          checked={form.avantages[av.key] !== ''}
                          onChange={e => setForm(prev => ({ ...prev, avantages: { ...prev.avantages, [av.key]: e.target.checked ? '0' : '' } }))}
                          className="rounded" />
                        {av.label}
                      </label>
                      {form.avantages[av.key] !== '' && (
                        <input type="number" min={0} placeholder="Montant FCFA/mois"
                          value={form.avantages[av.key]}
                          onChange={e => setForm(prev => ({ ...prev, avantages: { ...prev.avantages, [av.key]: e.target.value } }))}
                          className="field-input flex-1" />
                      )}
                    </div>
                  ))}
                  {([
                    { key: 'assurance', label: 'Assurance maladie' },
                    { key: 'treizieme', label: '13ème mois' },
                    { key: 'prime_rend', label: 'Prime de rendement' },
                  ] as const).map(av => (
                    <label key={av.key} className="flex items-center gap-2 text-[12px] text-[#374151] cursor-pointer select-none">
                      <input type="checkbox" checked={form.avantages[av.key] as boolean}
                        onChange={e => setForm(prev => ({ ...prev, avantages: { ...prev.avantages, [av.key]: e.target.checked } }))}
                        className="rounded" />
                      {av.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* SECTION 4 — Signatures */}
              <SectionTitle icon={Edit2} title="Section 4 — Signatures & Documents" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Date de signature</label>
                  <input type="date" value={form.signe_le} onChange={e => setField('signe_le', e.target.value)} className="field-input" />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-[12px] text-[#374151] cursor-pointer select-none">
                  <input type="checkbox" checked={form.signe_employe}
                    onChange={e => setField('signe_employe', e.target.checked)} className="rounded" />
                  Signé par l&apos;employé
                </label>
                <label className="flex items-center gap-2 text-[12px] text-[#374151] cursor-pointer select-none">
                  <input type="checkbox" checked={form.signe_employeur}
                    onChange={e => setField('signe_employeur', e.target.checked)} className="rounded" />
                  Signé par l&apos;employeur
                </label>
              </div>

              <div>
                <label className="field-label">Description / Clauses particulières</label>
                <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                  rows={3} placeholder="Clauses spécifiques, conditions particulières..."
                  className="field-input resize-none" />
              </div>
              <div>
                <label className="field-label">Notes internes</label>
                <textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
                  rows={2} placeholder="Notes confidentielles..."
                  className="field-input resize-none" />
              </div>

              {/* Récapitulatif temps réel */}
              {brut > 0 && (
                <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-4">
                  <p className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider mb-3">Récapitulatif financier</p>
                  {[
                    ['Salaire brut',          `${fmt(brut)} FCFA`],
                    ['CNSS salarié (5,04%)',  `- ${fmt(cnssEmp)} FCFA`],
                    ['Net estimé',            `${fmt(netEst)} FCFA`],
                    ['Coût total employeur',  `${fmt(coutPat)} FCFA`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[11px] py-1 border-b border-[#FDE68A] last:border-0">
                      <span className="text-[#92400E]">{k}</span>
                      <span className="font-bold text-[#0F172A]">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Boutons */}
              <div className="flex gap-3 pt-2 pb-4">
                <button type="button" onClick={() => setShowNew(false)}
                  className="flex-1 py-3 border border-[#E2E8F0] text-[#64748B] rounded-xl text-[13px] font-semibold hover:bg-[#F8FAFC] transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Créer le contrat
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — RENOUVELLEMENT
      ═══════════════════════════════════════════════════════════════════════ */}
      {showRenew && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowRenew(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-bold text-[#0F172A]">Renouveler le contrat</h3>
                <button onClick={() => setShowRenew(null)}><X size={16} className="text-[#64748B]" /></button>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl px-4 py-3 mb-5">
                <p className="text-[11px] text-[#64748B]">Contrat actuel</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{showRenew.employes?.nom}</p>
                <p className="text-[11px] text-[#94A3B8]">
                  {TYPE_CFG[showRenew.type_contrat]?.label} · {fmtDate(showRenew.date_debut)} → {fmtDate(showRenew.date_fin)}
                </p>
              </div>
              <form onSubmit={handleRenew} className="space-y-4">
                <div>
                  <label className="field-label">Nouveau type de contrat</label>
                  <select value={renewForm.type_contrat}
                    onChange={e => setRenewForm(p => ({ ...p, type_contrat: e.target.value as TypeContrat }))}
                    className="field-input">
                    {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Date de début</label>
                    <input type="date" value={renewForm.date_debut}
                      onChange={e => setRenewForm(p => ({ ...p, date_debut: e.target.value }))} className="field-input" />
                  </div>
                  {TYPES_AVEC_FIN.includes(renewForm.type_contrat) && (
                    <div>
                      <label className="field-label">Date de fin</label>
                      <input type="date" value={renewForm.date_fin}
                        onChange={e => setRenewForm(p => ({ ...p, date_fin: e.target.value }))} className="field-input" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="field-label">Nouveau salaire brut (FCFA)</label>
                  <input type="number" min={0} value={renewForm.salaire_base}
                    onChange={e => setRenewForm(p => ({ ...p, salaire_base: e.target.value }))} className="field-input" />
                </div>
                <div>
                  <label className="field-label">Motif du renouvellement</label>
                  <input type="text" value={renewForm.motif} placeholder="Continuation de mission, CDI proposé..."
                    onChange={e => setRenewForm(p => ({ ...p, motif: e.target.value }))} className="field-input" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowRenew(null)}
                    className="flex-1 py-2.5 border border-[#E2E8F0] text-[#64748B] rounded-xl text-[12px] font-semibold hover:bg-[#F8FAFC]">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-[12px] font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Renouveler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — RÉSILIATION
      ═══════════════════════════════════════════════════════════════════════ */}
      {showTerminate && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowTerminate(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-bold text-[#DC2626]">Résilier le contrat</h3>
                <button onClick={() => setShowTerminate(null)}><X size={16} className="text-[#64748B]" /></button>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                <p className="text-[12px] font-semibold text-red-700">{showTerminate.employes?.nom}</p>
                <p className="text-[11px] text-red-500">{TYPE_CFG[showTerminate.type_contrat]?.label} · depuis le {fmtDate(showTerminate.date_debut)}</p>
              </div>
              <form onSubmit={handleTerminate} className="space-y-4">
                <div>
                  <label className="field-label">Type de résiliation *</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { val: 'demission',            label: 'Démission (employé)' },
                      { val: 'licenciement',         label: 'Licenciement (employeur)' },
                      { val: 'rupture_conventionnelle', label: 'Rupture conventionnelle' },
                      { val: 'fin_essai',            label: "Fin de période d'essai" },
                      { val: 'fin_cdd',              label: 'Fin de CDD naturelle' },
                    ].map(opt => (
                      <label key={opt.val} className="flex items-center gap-2 text-[12px] text-[#374151] cursor-pointer select-none">
                        <input type="radio" name="type_res" value={opt.val}
                          checked={termForm.type_resiliation === opt.val}
                          onChange={e => setTermForm(p => ({ ...p, type_resiliation: e.target.value }))} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Date de résiliation</label>
                    <input type="date" value={termForm.date_resiliation}
                      onChange={e => setTermForm(p => ({ ...p, date_resiliation: e.target.value }))} className="field-input" required />
                  </div>
                  <div>
                    <label className="field-label">Préavis (jours)</label>
                    <input type="number" min={0} value={termForm.preavis_jours}
                      onChange={e => setTermForm(p => ({ ...p, preavis_jours: e.target.value }))} className="field-input" />
                  </div>
                </div>
                <div>
                  <label className="field-label">Motif détaillé</label>
                  <textarea value={termForm.motif} rows={3}
                    onChange={e => setTermForm(p => ({ ...p, motif: e.target.value }))}
                    placeholder="Motif de la résiliation..." className="field-input resize-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowTerminate(null)}
                    className="flex-1 py-2.5 border border-[#E2E8F0] text-[#64748B] rounded-xl text-[12px] font-semibold hover:bg-[#F8FAFC]">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-[12px] font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                    Confirmer la résiliation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Styles partagés */}
      <style>{`
        .field-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #64748B;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .field-input {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          font-size: 13px;
          color: #0F172A;
          background: #FAFAFA;
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input:focus { border-color: #F59E0B; background: #fff; }
        .field-input-lg {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid #E2E8F0;
          border-radius: 12px;
          font-size: 18px;
          font-weight: 700;
          color: #0F172A;
          background: #FFFBEB;
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input-lg:focus { border-color: #F59E0B; }
      `}</style>
    </div>
  )
}

// ── Composant utilitaire ──────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title }: { icon: React.FC<{ size: number; className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] flex items-center justify-center shrink-0">
        <Icon size={13} className="text-[#F59E0B]" />
      </div>
      <p className="text-[13px] font-bold text-[#0F172A]">{title}</p>
      <div className="flex-1 h-px bg-[#E2E8F0]" />
    </div>
  )
}
