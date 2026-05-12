'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, GraduationCap, Loader2, BookOpen, CreditCard,
  ClipboardList, Lock, Unlock, Bell, ChevronRight,
  AlertCircle, CheckCircle, TrendingUp, User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  type Etudiant, type Note, type PaiementScolaire, type Absence,
  NIVEAUX, PERIODES, fmt, generateCode, calcMoyenne, getMention, MENTIONS,
  StatutBadge, Avatar, KpiCard,
} from '../_lib/shared'

const STORAGE_KEY = 'oraforme_student_numero_id'

// ── Résoudre le rôle école ────────────────────────────────────────────────────

async function getEcoleRole(): Promise<{ role: string | null; email: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { role: null, email: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('ecole_role_name, role')
    .eq('user_id', user.id)
    .maybeSingle()
  const ecoleRole = profile?.ecole_role_name ?? (profile?.role === 'owner' ? 'DIRECTION_GENERALE' : null)
  return { role: ecoleRole, email: user.email ?? null }
}

// ── Vue dossier complet ───────────────────────────────────────────────────────

function DossierEtudiant({ etudiant, notes, paiements, absences, notifs, loading, blocking, onToggleBlock, isAdmin }: {
  etudiant: Etudiant
  notes: Note[]
  paiements: PaiementScolaire[]
  absences: Absence[]
  notifs: { id: string; titre: string; message: string; read: boolean; created_at: string }[]
  loading: boolean
  blocking: boolean
  onToggleBlock?: () => void
  isAdmin: boolean
}) {
  const [activeTab, setActiveTab] = useState<'notes' | 'paiements' | 'absences' | 'alertes'>('notes')

  const totalPaye      = paiements.filter(p => p.statut === 'paye').reduce((s, p) => s + p.montant, 0)
  const totalAbs       = absences.length
  const justifiedAbs   = absences.filter(a => a.justifiee).length
  const moyenneGlobale = notes.length > 0 ? calcMoyenne(notes) : null
  const mention        = moyenneGlobale !== null ? getMention(moyenneGlobale) : null
  const nbAlerts       = notifs.filter(n => !n.read).length

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#8B949E]" size={18} /></div>

  return (
    <div className="space-y-4">
      {/* Student card */}
      <div className="rounded-xl border border-[#06B6D4]/20 p-5" style={{ background: 'rgba(6,182,212,0.06)' }}>
        <div className="flex items-start gap-4">
          <Avatar nom={etudiant.nom} prenom={etudiant.prenom} photoUrl={etudiant.photo_url} size={56} />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{etudiant.prenom} {etudiant.nom}</h2>
            <p className="text-xs text-[#8B949E] mt-0.5">{etudiant.numero_id} · {etudiant.classe ?? NIVEAUX.find(n => n.value === etudiant.niveau)?.label} · {etudiant.annee_scolaire}</p>
            <div className="mt-1"><StatutBadge statut={etudiant.statut} /></div>
          </div>
          {isAdmin && onToggleBlock && (
            <button onClick={onToggleBlock} disabled={blocking}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={etudiant.statut === 'suspendu' ? { background: '#2EA043', color: '#fff' } : { background: '#F85149', color: '#fff' }}>
              {blocking ? <Loader2 size={12} className="animate-spin" /> : etudiant.statut === 'suspendu' ? <><Unlock size={12} /> Débloquer</> : <><Lock size={12} /> Suspendre</>}
            </button>
          )}
        </div>
        {isAdmin && etudiant.statut === 'suspendu' && etudiant.code_deblocage && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] text-[#8B949E]">Code de déblocage : <span className="font-mono font-bold text-[#F0A30A]">{etudiant.code_deblocage}</span></p>
          </div>
        )}
      </div>

      {/* Warning */}
      {etudiant.statut === 'suspendu' && (
        <div className="rounded-xl border border-[#F85149]/30 p-4 flex items-start gap-3" style={{ background: 'rgba(248,81,73,0.06)' }}>
          <AlertCircle size={16} className="text-[#F85149] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-[#F85149]">Accès suspendu</p>
            <p className="text-xs text-[#8B949E] mt-0.5">Un solde impayé a été détecté. Régularisez votre situation auprès de l&apos;administration.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Total payé"       value={`${fmt(totalPaye)} FCFA`}              color="#2EA043" />
        <KpiCard label="Moyenne générale" value={moyenneGlobale !== null ? `${moyenneGlobale.toFixed(2)}/20` : '—'} color={mention?.color ?? '#8B949E'} sub={mention?.label} />
        <KpiCard label="Absences"         value={totalAbs}                               color="#F85149" sub={`${justifiedAbs} justifiées`} />
        <KpiCard label="Alertes"          value={nbAlerts}                               color="#F0A30A" sub="non lues" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
        {[
          { id: 'notes'     as const, label: 'Mes notes',    icon: BookOpen,      count: notes.length },
          { id: 'paiements' as const, label: 'Paiements',    icon: CreditCard,    count: paiements.length },
          { id: 'absences'  as const, label: 'Absences',     icon: ClipboardList, count: totalAbs },
          { id: 'alertes'   as const, label: 'Notifications',icon: Bell,          count: nbAlerts },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ background: activeTab === t.id ? '#06B6D4' : 'transparent', color: activeTab === t.id ? '#fff' : '#8B949E' }}>
              <Icon size={12} />{t.label}
              {t.count > 0 && activeTab !== t.id && <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] bg-white/[0.08] text-[#8B949E]">{t.count}</span>}
            </button>
          )
        })}
      </div>

      {/* Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {notes.length === 0 ? (
            <div className="text-center py-10 text-[#8B949E] text-xs">Aucune note enregistrée.</div>
          ) : PERIODES.map(p => {
            const pNotes = notes.filter(n => n.periode === p.value)
            if (pNotes.length === 0) return null
            const moy = calcMoyenne(notes, p.value)
            const men = moy !== null ? getMention(moy) : null
            return (
              <div key={p.value} className="rounded-xl border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">{p.label}</p>
                  {moy !== null && men && (
                    <div className="flex items-center gap-2">
                      <TrendingUp size={12} style={{ color: men.color }} />
                      <span className="text-sm font-bold text-white">{moy.toFixed(2)} / 20</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: men.color, background: men.color + '20' }}>{men.label}</span>
                    </div>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Matière', 'Type', 'Note', '/Max', 'Moy /20', 'Coeff.', 'Mention'].map(h => <th key={h} className="text-left px-4 py-2 text-[10px] text-[#8B949E]">{h}</th>)}</tr></thead>
                  <tbody>
                    {pNotes.map(n => {
                      const moy20 = (n.note / n.note_max) * 20
                      const m = MENTIONS.find(x => moy20 >= x.min) ?? MENTIONS[MENTIONS.length - 1]
                      return (
                        <tr key={n.id} className="border-t border-white/[0.04]">
                          <td className="px-4 py-2.5 font-medium text-white">{n.matiere}</td>
                          <td className="px-4 py-2.5 text-[#8B949E] capitalize">{n.type_note}</td>
                          <td className="px-4 py-2.5 font-bold text-white">{n.note}</td>
                          <td className="px-4 py-2.5 text-[#8B949E]">{n.note_max}</td>
                          <td className="px-4 py-2.5"><span className="font-bold px-1.5 py-0.5 rounded text-[10px]" style={{ color: m.color, background: m.color + '20' }}>{moy20.toFixed(2)}</span></td>
                          <td className="px-4 py-2.5 text-[#8B949E]">{n.coefficient}</td>
                          <td className="px-4 py-2.5"><span className="text-[10px]" style={{ color: m.color }}>{m.label}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Paiements */}
      {activeTab === 'paiements' && (
        paiements.length === 0 ? (
          <div className="text-center py-10 text-[#8B949E] text-xs">Aucun paiement enregistré.</div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Date', 'Libellé', 'Mode', 'Montant', 'Statut'].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E]">{h}</th>)}</tr></thead>
              <tbody>
                {paiements.map(p => (
                  <tr key={p.id} className="border-t border-white/[0.04]">
                    <td className="px-4 py-2.5 text-[#8B949E]">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-white">{p.libelle}</td>
                    <td className="px-4 py-2.5 text-[#8B949E] capitalize">{p.methode.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#2EA043]">{fmt(p.montant)} FCFA</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={p.statut === 'paye' ? { color: '#2EA043', background: '#2EA04318' } : { color: '#F0A30A', background: '#F0A30A18' }}>
                        {p.statut === 'paye' ? 'Payé' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Absences */}
      {activeTab === 'absences' && (
        absences.length === 0 ? (
          <div className="text-center py-10 text-[#8B949E] text-xs">Aucune absence enregistrée.</div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Date', 'Matière', 'Motif', 'Statut'].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E]">{h}</th>)}</tr></thead>
              <tbody>
                {absences.map(a => (
                  <tr key={a.id} className="border-t border-white/[0.04]">
                    <td className="px-4 py-2.5 text-[#8B949E]">{new Date(a.date_absence + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-white">{a.matiere ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#8B949E]">{a.motif ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={a.justifiee ? { color: '#2EA043', background: '#2EA04318' } : { color: '#F85149', background: '#F8514918' }}>
                        {a.justifiee ? 'Justifiée' : 'Non justifiée'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Alertes */}
      {activeTab === 'alertes' && (
        notifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#8B949E]">
            <CheckCircle size={28} className="mb-2 opacity-30" />
            <p className="text-xs">Aucune notification</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map(n => (
              <div key={n.id} className={`rounded-xl border p-3 ${n.read ? 'border-white/[0.04] opacity-60' : 'border-[#06B6D4]/30'}`} style={{ background: n.read ? 'rgba(255,255,255,0.01)' : 'rgba(6,182,212,0.04)' }}>
                <div className="flex items-start gap-2">
                  <Bell size={12} className={n.read ? 'text-[#8B949E]' : 'text-[#06B6D4]'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{n.titre}</p>
                    <p className="text-[10px] text-[#8B949E] mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-[#484F58] mt-1">{new Date(n.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EspaceEtudiantPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [ecoleRole,   setEcoleRole]   = useState<string | null>(null)
  const [selected,    setSelected]    = useState<Etudiant | null>(null)
  const [notes,       setNotes]       = useState<Note[]>([])
  const [paiements,   setPaiements]   = useState<PaiementScolaire[]>([])
  const [absences,    setAbsences]    = useState<Absence[]>([])
  const [notifs,      setNotifs]      = useState<{ id: string; titre: string; message: string; read: boolean; created_at: string }[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [blocking,    setBlocking]    = useState(false)
  const [initLoading, setInitLoading] = useState(true)

  // Student self-portal state
  const [studentId,   setStudentId]   = useState('')
  const [idError,     setIdError]     = useState<string | null>(null)
  const [searching,   setSearching]   = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)

  // Admin search state
  const [adminSearch, setAdminSearch] = useState('')
  const [adminResults,setAdminResults]= useState<Etudiant[]>([])
  const [adminSearching,setAdminSearching] = useState(false)

  const isStudent = ecoleRole === 'ETUDIANT'
  const isAdmin   = !isStudent

  useEffect(() => {
    async function init() {
      setInitLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const { role } = await getEcoleRole()
      setEcoleRole(role)

      // Auto-load by user_id if student role
      if (role === 'ETUDIANT' && user && tenantId) {
        setAutoLoading(true)
        const { data: etu } = await supabase
          .from('etudiants')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id)
          .maybeSingle()
        if (etu) {
          await loadStudentData(etu as Etudiant)
        } else {
          // Fallback: try email match
          const { data: etuByEmail } = await supabase
            .from('etudiants')
            .select('*')
            .eq('tenant_id', tenantId)
            .ilike('email', user.email ?? '')
            .maybeSingle()
          if (etuByEmail) await loadStudentData(etuByEmail as Etudiant)
          // Otherwise: show manual ID entry
        }
        setAutoLoading(false)
      }

      // Restore cached student ID as fallback
      if (role === 'ETUDIANT') {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) setStudentId(saved)
      }
      setInitLoading(false)
    }
    if (!tenantLoading) init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, tenantLoading])

  async function loadStudentData(etu: Etudiant) {
    setSelected(etu)
    setLoadingData(true)
    const [{ data: n }, { data: p }, { data: a }, { data: notifData }] = await Promise.all([
      supabase.from('notes_etudiants').select('*').eq('etudiant_id', etu.id).order('created_at', { ascending: false }),
      supabase.from('paiements_scolaires').select('*').eq('etudiant_id', etu.id).order('created_at', { ascending: false }),
      supabase.from('absences_etudiants').select('*').eq('etudiant_id', etu.id).order('date_absence', { ascending: false }),
      supabase.from('notifications').select('id,titre,message,read,created_at').eq('etudiant_id', etu.id).order('created_at', { ascending: false }).limit(20),
    ])
    setNotes((n ?? []) as Note[])
    setPaiements((p ?? []) as PaiementScolaire[])
    setAbsences((a ?? []) as Absence[])
    setNotifs((notifData ?? []) as typeof notifs)
    setLoadingData(false)
  }

  // Student: search by numero_id
  async function lookupByNumeroId() {
    if (!tenantId || !studentId.trim()) return
    setSearching(true); setIdError(null)
    const { data } = await supabase.from('etudiants').select('*')
      .eq('tenant_id', tenantId)
      .ilike('numero_id', studentId.trim())
      .maybeSingle()
    if (!data) {
      setIdError("Numéro étudiant introuvable. Vérifiez votre carte ou contactez l'administration.")
      setSearching(false); return
    }
    localStorage.setItem(STORAGE_KEY, studentId.trim())
    await loadStudentData(data as Etudiant)
    setSearching(false)
  }

  // Admin: search by name/id
  async function adminSearchStudents() {
    if (!tenantId || !adminSearch.trim()) return
    setAdminSearching(true)
    const { data } = await supabase.from('etudiants').select('*').eq('tenant_id', tenantId)
      .or(`numero_id.ilike.%${adminSearch}%,nom.ilike.%${adminSearch}%,prenom.ilike.%${adminSearch}%`)
      .limit(15)
    setAdminResults((data ?? []) as Etudiant[])
    setAdminSearching(false)
  }

  async function toggleBlock() {
    if (!selected || !tenantId) return
    setBlocking(true)
    if (selected.statut === 'suspendu') {
      await supabase.from('etudiants').update({ statut: 'actif', code_deblocage: null }).eq('id', selected.id)
      setSelected(s => s ? { ...s, statut: 'actif', code_deblocage: null } : s)
    } else {
      const code = generateCode()
      await supabase.from('etudiants').update({ statut: 'suspendu', code_deblocage: code }).eq('id', selected.id)
      setSelected(s => s ? { ...s, statut: 'suspendu', code_deblocage: code } : s)
    }
    setBlocking(false)
  }

  if (tenantLoading || initLoading || autoLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#8B949E] gap-3">
        <Loader2 className="animate-spin" size={24} />
        <p className="text-sm">{autoLoading ? 'Chargement de votre dossier…' : 'Chargement…'}</p>
      </div>
    )
  }

  // ── Vue ÉTUDIANT (self-portal) ─────────────────────────────────────────────

  if (isStudent) {
    if (selected) {
      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Mon Dossier</h1>
              <p className="text-xs text-[#8B949E] mt-0.5">Résultats, paiements, absences</p>
            </div>
            <button onClick={() => { setSelected(null); localStorage.removeItem(STORAGE_KEY) }} className="px-3 py-2 rounded-lg text-xs border border-white/[0.06] text-[#8B949E] hover:text-white">
              Changer de compte
            </button>
          </div>
          <DossierEtudiant etudiant={selected} notes={notes} paiements={paiements} absences={absences} notifs={notifs} loading={loadingData} blocking={blocking} isAdmin={false} />
        </div>
      )
    }

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Espace Étudiant</h1>
          <p className="text-xs text-[#8B949E] mt-0.5">Accédez à votre dossier scolaire</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#06B6D4]/20 p-8 flex flex-col items-center text-center" style={{ background: 'rgba(6,182,212,0.04)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg,#0E4A5F,#0891B2)' }}>
            <User size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Accès à mon dossier</h2>
          <p className="text-xs text-[#8B949E] mb-6 max-w-sm">Entrez votre numéro étudiant (visible sur votre carte ou attestation d&apos;inscription)</p>
          <div className="flex gap-2 w-full max-w-sm">
            <input
              className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#06B6D4]/50 text-center font-mono tracking-widest"
              placeholder="Ex : ETU-2024-001"
              value={studentId}
              onChange={e => { setStudentId(e.target.value); setIdError(null) }}
              onKeyDown={e => e.key === 'Enter' && lookupByNumeroId()}
            />
            <button onClick={lookupByNumeroId} disabled={searching || !studentId.trim()}
              className="px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#0E4A5F,#0891B2)', color: '#fff' }}>
              {searching ? <Loader2 className="animate-spin" size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
          {idError && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-[#F85149] flex items-center gap-1.5">
              <AlertCircle size={12} /> {idError}
            </motion.p>
          )}
        </motion.div>
      </div>
    )
  }

  // ── Vue ADMIN ─────────────────────────────────────────────────────────────────

  if (selected) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Espace Étudiant</h1>
          <p className="text-xs text-[#8B949E] mt-0.5">Administration · Dossier élève</p>
        </div>
        <button onClick={() => { setSelected(null); setAdminResults([]) }} className="flex items-center gap-1.5 text-xs text-[#8B949E] hover:text-white">
          <ChevronRight size={12} className="rotate-180" /> Retour à la recherche
        </button>
        <DossierEtudiant etudiant={selected} notes={notes} paiements={paiements} absences={absences} notifs={notifs} loading={loadingData} blocking={blocking} onToggleBlock={toggleBlock} isAdmin={true} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Espace Étudiant</h1>
        <p className="text-xs text-[#8B949E] mt-0.5">Accédez au dossier complet d&apos;un étudiant — résultats, paiements, absences</p>
      </div>

      <div className="rounded-xl border border-[#06B6D4]/20 p-4 space-y-3" style={{ background: 'rgba(6,182,212,0.04)' }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B949E]" />
            <input
              className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#06B6D4]/50"
              placeholder="N° étudiant, nom, prénom…"
              value={adminSearch}
              onChange={e => setAdminSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adminSearchStudents()}
            />
          </div>
          <button onClick={adminSearchStudents} disabled={adminSearching || !adminSearch.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#0E4A5F,#0891B2)', color: '#fff' }}>
            {adminSearching ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />} Rechercher
          </button>
        </div>
      </div>

      {adminResults.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">{adminResults.length} résultat(s)</p>
          </div>
          {adminResults.map(e => (
            <button key={e.id} onClick={() => loadStudentData(e)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] text-left transition-colors group">
              <Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={36} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{e.prenom} {e.nom}</p>
                <p className="text-xs text-[#8B949E]">{e.numero_id} · {e.classe ?? NIVEAUX.find(n => n.value === e.niveau)?.label}</p>
              </div>
              <StatutBadge statut={e.statut} />
              <ChevronRight size={14} className="text-[#8B949E] group-hover:text-[#06B6D4] transition-colors" />
            </button>
          ))}
        </div>
      )}

      {!adminSearching && adminResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-[#484F58]">
          <GraduationCap size={40} className="mb-4 opacity-20" />
          <p className="text-sm">Recherchez un étudiant par nom ou numéro</p>
        </div>
      )}
    </div>
  )
}
