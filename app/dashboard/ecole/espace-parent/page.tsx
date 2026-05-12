'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, HeartHandshake, Loader2, BookOpen, CreditCard,
  ClipboardList, Phone, Mail, Bell, ChevronRight, AlertCircle,
  CheckCircle, TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  type Etudiant, type Note, type PaiementScolaire, type Absence,
  NIVEAUX, PERIODES, fmt, calcMoyenne, getMention, MENTIONS,
  StatutBadge, Avatar, KpiCard,
} from '../_lib/shared'

// ── Résoudre le rôle école du user ────────────────────────────────────────────

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

// ── Dossier étudiant partagé ──────────────────────────────────────────────────

function DossierEtudiant({ etudiant, onBack, accentColor = '#EC4899' }: {
  etudiant: Etudiant; onBack: () => void; accentColor?: string
}) {
  const [notes,     setNotes]     = useState<Note[]>([])
  const [paiements, setPaiements] = useState<PaiementScolaire[]>([])
  const [absences,  setAbsences]  = useState<Absence[]>([])
  const [notifs,    setNotifs]    = useState<{ id: string; titre: string; message: string; read: boolean; created_at: string }[]>([])
  const [activeTab, setActiveTab] = useState<'notes' | 'paiements' | 'absences' | 'alertes'>('notes')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: n }, { data: p }, { data: a }, { data: notifData }] = await Promise.all([
        supabase.from('notes_etudiants').select('*').eq('etudiant_id', etudiant.id).order('created_at', { ascending: false }),
        supabase.from('paiements_scolaires').select('*').eq('etudiant_id', etudiant.id).order('created_at', { ascending: false }),
        supabase.from('absences_etudiants').select('*').eq('etudiant_id', etudiant.id).order('date_absence', { ascending: false }),
        supabase.from('notifications').select('id,titre,message,read,created_at').eq('etudiant_id', etudiant.id).order('created_at', { ascending: false }).limit(20),
      ])
      setNotes((n ?? []) as Note[])
      setPaiements((p ?? []) as PaiementScolaire[])
      setAbsences((a ?? []) as Absence[])
      setNotifs((notifData ?? []) as typeof notifs)
      setLoading(false)
    }
    load()
  }, [etudiant.id])

  const totalPaye      = paiements.filter(p => p.statut === 'paye').reduce((s, p) => s + p.montant, 0)
  const totalAbs       = absences.length
  const justifiedAbs   = absences.filter(a => a.justifiee).length
  const moyenneGlobale = notes.length > 0 ? calcMoyenne(notes) : null
  const mention        = moyenneGlobale !== null ? getMention(moyenneGlobale) : null
  const nbAlerts       = notifs.filter(n => !n.read).length

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border p-5" style={{ borderColor: accentColor + '30', background: accentColor + '08' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar nom={etudiant.nom} prenom={etudiant.prenom} photoUrl={etudiant.photo_url} size={56} />
            <div>
              <h2 className="text-lg font-bold text-white">{etudiant.prenom} {etudiant.nom}</h2>
              <p className="text-xs text-[#8B949E] mt-0.5">{etudiant.numero_id} · {etudiant.classe ?? NIVEAUX.find(n => n.value === etudiant.niveau)?.label} · {etudiant.annee_scolaire}</p>
              <div className="mt-1"><StatutBadge statut={etudiant.statut} /></div>
            </div>
          </div>
          <button onClick={onBack} className="px-3 py-2 rounded-lg text-xs border border-white/[0.08] text-[#8B949E] hover:text-white">
            ← Retour
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: accentColor }}>Contacts</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {etudiant.nom_pere && <span className="text-[#8B949E]">Père : <span className="text-white">{etudiant.nom_pere}</span></span>}
            {etudiant.nom_mere && <span className="text-[#8B949E]">Mère : <span className="text-white">{etudiant.nom_mere}</span></span>}
            {etudiant.tel_parent && <a href={`tel:${etudiant.tel_parent}`} className="flex items-center gap-1 hover:underline" style={{ color: accentColor }}><Phone size={10} />{etudiant.tel_parent}</a>}
            {etudiant.email_parent && <a href={`mailto:${etudiant.email_parent}`} className="flex items-center gap-1 hover:underline" style={{ color: accentColor }}><Mail size={10} />{etudiant.email_parent}</a>}
          </div>
        </div>
      </div>

      {/* Suspended warning */}
      {etudiant.statut === 'suspendu' && (
        <div className="rounded-xl border border-[#F85149]/30 p-4" style={{ background: 'rgba(248,81,73,0.06)' }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-[#F85149]" />
            <p className="text-sm font-bold text-[#F85149]">Accès suspendu — solde impayé détecté</p>
          </div>
          <p className="text-xs text-[#8B949E] mt-1 ml-6">Veuillez vous rapprocher de l&apos;administration pour régulariser la situation.</p>
        </div>
      )}

      {/* KPIs */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#8B949E]" size={18} /></div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Total payé"       value={`${fmt(totalPaye)} FCFA`}           color="#2EA043" />
            <KpiCard label="Moyenne générale" value={moyenneGlobale !== null ? `${moyenneGlobale.toFixed(2)}/20` : '—'} color={mention?.color ?? '#8B949E'} sub={mention?.label} />
            <KpiCard label="Absences"         value={totalAbs}                            color="#F85149" sub={`${justifiedAbs} justifiées`} />
            <KpiCard label="Alertes"          value={nbAlerts}                            color="#F0A30A" sub="non lues" />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
            {[
              { id: 'notes'     as const, label: 'Résultats',  icon: BookOpen,      count: notes.length },
              { id: 'paiements' as const, label: 'Paiements',  icon: CreditCard,    count: paiements.length },
              { id: 'absences'  as const, label: 'Absences',   icon: ClipboardList, count: totalAbs },
              { id: 'alertes'   as const, label: 'Alertes',    icon: Bell,          count: nbAlerts },
            ].map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all relative"
                  style={{ background: activeTab === t.id ? accentColor : 'transparent', color: activeTab === t.id ? '#fff' : '#8B949E' }}>
                  <Icon size={12} /> {t.label}
                  {t.count > 0 && activeTab !== t.id && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/[0.08] text-[#8B949E]">{t.count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Notes */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {notes.length === 0 ? (
                <div className="text-center py-10 text-[#8B949E] text-xs">Aucune note disponible.</div>
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
                          <span className="text-sm font-bold text-white">{moy.toFixed(2)} / 20</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: men.color, background: men.color + '20' }}>{men.label}</span>
                        </div>
                      )}
                    </div>
                    <table className="w-full text-xs">
                      <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Matière', 'Note', '/Max', 'Moy /20', 'Coeff.'].map(h => <th key={h} className="text-left px-4 py-2 text-[10px] text-[#8B949E]">{h}</th>)}</tr></thead>
                      <tbody>
                        {pNotes.map(n => {
                          const moy20 = (n.note / n.note_max) * 20
                          const m = MENTIONS.find(x => moy20 >= x.min) ?? MENTIONS[MENTIONS.length - 1]
                          return (
                            <tr key={n.id} className="border-t border-white/[0.04]">
                              <td className="px-4 py-2.5 font-medium text-white">{n.matiere}</td>
                              <td className="px-4 py-2.5 font-bold text-white">{n.note}</td>
                              <td className="px-4 py-2.5 text-[#8B949E]">{n.note_max}</td>
                              <td className="px-4 py-2.5"><span className="font-bold px-1.5 py-0.5 rounded text-[10px]" style={{ color: m.color, background: m.color + '20' }}>{moy20.toFixed(2)}</span></td>
                              <td className="px-4 py-2.5 text-[#8B949E]">{n.coefficient}</td>
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

          {/* Alertes / Notifications */}
          {activeTab === 'alertes' && (
            notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#8B949E]">
                <CheckCircle size={28} className="mb-2 opacity-30" />
                <p className="text-xs">Aucune alerte pour cet enfant</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifs.map(n => (
                  <div key={n.id} className={`rounded-xl border p-3 ${n.read ? 'border-white/[0.04] opacity-60' : 'border-[#F0A30A]/30'}`} style={{ background: n.read ? 'rgba(255,255,255,0.01)' : 'rgba(240,163,10,0.04)' }}>
                    <div className="flex items-start gap-2">
                      <Bell size={12} className={n.read ? 'text-[#8B949E]' : 'text-[#F0A30A]'} />
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
        </>
      )}
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EspaceParentPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [ecoleRole,  setEcoleRole]  = useState<string | null>(null)
  const [userEmail,  setUserEmail]  = useState<string | null>(null)
  const [children,   setChildren]   = useState<Etudiant[]>([])  // auto-loaded for PARENT
  const [selected,   setSelected]   = useState<Etudiant | null>(null)
  // Admin search
  const [search,     setSearch]     = useState('')
  const [results,    setResults]    = useState<Etudiant[]>([])
  const [searching,  setSearching]  = useState(false)
  const [initLoading,setInitLoading]= useState(true)

  const isParentRole = ecoleRole === 'PARENT'
  const isAdmin      = ['DIRECTION_GENERALE', 'RAF', 'SCOLARITE', 'RH_PAIE'].includes(ecoleRole ?? '')
    || (!isParentRole && !['ETUDIANT', 'FORMATEUR'].includes(ecoleRole ?? ''))

  const load = useCallback(async () => {
    if (!tenantId) return
    setInitLoading(true)
    const { role, email } = await getEcoleRole()
    setEcoleRole(role)
    setUserEmail(email)

    if (role === 'PARENT' && email) {
      // Auto-load children whose parent email matches
      const { data } = await supabase.from('etudiants').select('*').eq('tenant_id', tenantId)
        .or(`email_parent.ilike.${email},tel_parent.ilike.${email}`)
      setChildren((data ?? []) as Etudiant[])
      // Auto-select if only one child
      if ((data ?? []).length === 1) setSelected((data as Etudiant[])[0])
    }
    setInitLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function searchByParent() {
    if (!tenantId || !search.trim()) return
    setSearching(true)
    const { data } = await supabase.from('etudiants').select('*').eq('tenant_id', tenantId)
      .or(`tel_parent.ilike.%${search}%,email_parent.ilike.%${search}%,nom_pere.ilike.%${search}%,nom_mere.ilike.%${search}%,nom.ilike.%${search}%,prenom.ilike.%${search}%`)
      .limit(15)
    setResults((data ?? []) as Etudiant[])
    setSearching(false)
  }

  if (tenantLoading || initLoading) {
    return <div className="flex items-center justify-center h-64 text-[#8B949E]"><Loader2 className="animate-spin mr-2" size={18} /> Chargement…</div>
  }

  // ── Vue PARENT ────────────────────────────────────────────────────────────────
  if (isParentRole) {
    if (selected) {
      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Espace Parent</h1>
              <p className="text-xs text-[#8B949E] mt-0.5">Dossier de votre enfant</p>
            </div>
            {children.length > 1 && (
              <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs text-[#8B949E] hover:text-white border border-white/[0.06] px-3 py-2 rounded-lg">
                <ChevronRight size={12} className="rotate-180" /> Mes enfants
              </button>
            )}
          </div>
          <DossierEtudiant etudiant={selected} onBack={() => setSelected(null)} accentColor="#EC4899" />
        </div>
      )
    }

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Espace Parent</h1>
          <p className="text-xs text-[#8B949E] mt-0.5">Suivi de vos enfants</p>
        </div>

        {children.length === 0 ? (
          <div className="rounded-xl border border-[#F0A30A]/20 p-8 flex flex-col items-center text-center" style={{ background: 'rgba(240,163,10,0.04)' }}>
            <AlertCircle size={32} className="text-[#F0A30A] mb-3" />
            <p className="text-sm font-semibold text-white mb-1">Aucun enfant trouvé</p>
            <p className="text-xs text-[#8B949E] max-w-sm">
              Aucun étudiant n&apos;est associé à l&apos;email <strong className="text-white">{userEmail}</strong>.<br/>
              Contactez l&apos;administration pour lier votre compte à votre enfant.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">{children.length} enfant{children.length > 1 ? 's' : ''}</p>
            {children.map(etu => (
              <button key={etu.id} onClick={() => setSelected(etu)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] hover:border-[#EC4899]/30 hover:bg-[#EC4899]/[0.04] text-left transition-all group">
                <Avatar nom={etu.nom} prenom={etu.prenom} photoUrl={etu.photo_url} size={44} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{etu.prenom} {etu.nom}</p>
                  <p className="text-xs text-[#8B949E]">{etu.numero_id} · {etu.classe ?? NIVEAUX.find(n => n.value === etu.niveau)?.label} · {etu.annee_scolaire}</p>
                  <div className="mt-1"><StatutBadge statut={etu.statut} /></div>
                </div>
                <ChevronRight size={16} className="text-[#8B949E] group-hover:text-[#EC4899] transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Vue ADMIN (Scolarité, Direction, etc.) ────────────────────────────────────
  if (selected) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Espace Parent</h1>
          <p className="text-xs text-[#8B949E] mt-0.5">Administration · Dossier famille</p>
        </div>
        <DossierEtudiant etudiant={selected} onBack={() => { setSelected(null); setResults([]) }} accentColor="#EC4899" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Espace Parent</h1>
        <p className="text-xs text-[#8B949E] mt-0.5">Recherche par téléphone, email, nom du parent ou de l&apos;enfant</p>
      </div>

      <div className="rounded-xl border border-[#EC4899]/20 p-4 space-y-3" style={{ background: 'rgba(236,72,153,0.04)' }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B949E]" />
            <input
              className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#EC4899]/50"
              placeholder="Tél, email parent, nom de l'enfant…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchByParent()}
            />
          </div>
          <button onClick={searchByParent} disabled={searching || !search.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-40" style={{ background: '#EC4899', color: '#fff' }}>
            {searching ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />} Rechercher
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">{results.length} résultat(s)</p>
          </div>
          {results.map(e => (
            <button key={e.id} onClick={() => setSelected(e)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] text-left transition-colors group">
              <Avatar nom={e.nom} prenom={e.prenom} photoUrl={e.photo_url} size={36} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{e.prenom} {e.nom}</p>
                <p className="text-xs text-[#8B949E]">{e.numero_id} · {e.classe ?? NIVEAUX.find(n => n.value === e.niveau)?.label}</p>
                <div className="flex gap-3 mt-1 text-[10px] text-[#484F58]">
                  {e.nom_pere && <span>Père : {e.nom_pere}</span>}
                  {e.nom_mere && <span>Mère : {e.nom_mere}</span>}
                  {e.tel_parent && <span className="flex items-center gap-0.5"><Phone size={9} /> {e.tel_parent}</span>}
                </div>
              </div>
              <StatutBadge statut={e.statut} />
              <ChevronRight size={14} className="text-[#8B949E] group-hover:text-[#EC4899] transition-colors" />
            </button>
          ))}
        </div>
      )}

      {!searching && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-[#484F58]">
          <HeartHandshake size={40} className="mb-4 opacity-20" />
          <p className="text-sm">Recherchez un parent ou un élève</p>
        </div>
      )}
    </div>
  )
}
