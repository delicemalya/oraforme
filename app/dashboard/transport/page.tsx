'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, Plus, X, Loader2, MapPin, User, Star,
  Clock, CheckCircle, AlertCircle, TrendingUp, Wallet,
  Phone, Navigation,
} from 'lucide-react'
import { useFmt } from '@/lib/hooks/useFmt'

type Chauffeur = {
  id: string
  nom: string
  telephone: string
  permis: string
  vehicule: string
  plaque: string
  statut: 'actif' | 'inactif' | 'en_course'
  created_at: string
}

type Course = {
  id: string
  chauffeur_id: string
  chauffeur_nom?: string
  depart: string
  arrivee: string
  distance_km: number
  tarif: number
  statut: 'en_attente' | 'en_cours' | 'terminee' | 'annulee'
  client_nom: string
  client_tel: string
  note?: number
  date: string
  created_at: string
}

function fadeUp(i: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: i * 0.07, ease: [0.23, 1, 0.32, 1] as const },
  }
}

export default function TransportPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId, loading: tLoading } = useTenant()
  const { t } = useLocale()
  const [tab, setTab]           = useState(0)
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [courses, setCourses]   = useState<Course[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [modal, setModal]       = useState<'course' | 'chauffeur' | null>(null)
  const [filterStatut, setFilterStatut] = useState<string>('all')

  const STATUTS_CHAUFFEUR: Record<string, { label: string; color: string; bg: string }> = {
    actif:     { label: t('transport.statusAvailable'), color: '#0F172A', bg: '#0F172A18' },
    inactif:   { label: t('transport.statusInactive'),  color: '#64748B', bg: '#64748B18' },
    en_course: { label: t('transport.statusOnRide'),    color: '#DC2626', bg: '#DC262618' },
  }

  const STATUTS_COURSE: Record<string, { label: string; color: string; bg: string }> = {
    en_attente: { label: t('transport.statusPending'),     color: '#DC2626', bg: '#DC262618' },
    en_cours:   { label: t('transport.statusInProgress'),  color: '#DC2626', bg: '#DC262618' },
    terminee:   { label: t('transport.statusDone'),        color: '#0F172A', bg: '#0F172A18' },
    annulee:    { label: t('transport.statusCancelled'),   color: '#DC2626', bg: '#DC262618' },
  }

  const TABS = [t('transport.tabCourses'), t('transport.tabDrivers'), t('transport.tabStats')]

  const [cForm, setCForm] = useState({
    chauffeur_id: '',
    client_nom: '',
    client_tel: '',
    depart: '',
    arrivee: '',
    distance_km: '',
    tarif: '',
    date: new Date().toISOString().split('T')[0],
  })

  const [dForm, setDForm] = useState({
    nom: '',
    telephone: '',
    permis: '',
    vehicule: '',
    plaque: '',
    statut: 'actif' as 'actif' | 'inactif',
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    const [{ data: ch }, { data: co }] = await Promise.all([
      supabase.from('chauffeurs').select('*').eq('tenant_id', tenantId).order('nom').limit(200),
      supabase.from('courses').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
    ])
    setChauffeurs(ch ?? [])
    setCourses(co ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tLoading && tenantId) load() }, [tLoading, tenantId, load])

  async function saveCourse() {
    if (!cForm.chauffeur_id || !cForm.depart || !cForm.arrivee || !tenantId) return
    setSaving(true)
    const chauffeur = chauffeurs.find(c => c.id === cForm.chauffeur_id)
    try {
      await supabase.from('courses').insert({
        tenant_id: tenantId,
        chauffeur_id: cForm.chauffeur_id,
        chauffeur_nom: chauffeur?.nom ?? '',
        client_nom: cForm.client_nom,
        client_tel: cForm.client_tel,
        depart: cForm.depart,
        arrivee: cForm.arrivee,
        distance_km: parseFloat(cForm.distance_km) || 0,
        tarif: parseFloat(cForm.tarif) || 0,
        statut: 'en_attente',
        date: cForm.date,
      })
      // Update chauffeur status
      await supabase.from('chauffeurs').update({ statut: 'en_course' }).eq('id', cForm.chauffeur_id)
    } catch {}
    setModal(null)
    setCForm({ chauffeur_id: '', client_nom: '', client_tel: '', depart: '', arrivee: '', distance_km: '', tarif: '', date: new Date().toISOString().split('T')[0] })
    setSaving(false)
    load()
  }

  async function saveChauffeur() {
    if (!dForm.nom || !tenantId) return
    setSaving(true)
    try {
      await supabase.from('chauffeurs').insert({ tenant_id: tenantId, ...dForm })
    } catch {}
    setModal(null)
    setDForm({ nom: '', telephone: '', permis: '', vehicule: '', plaque: '', statut: 'actif' })
    setSaving(false)
    load()
  }

  async function updateStatutCourse(id: string, statut: string, chauffeurId?: string) {
    try {
      await supabase.from('courses').update({ statut }).eq('id', id)
      if (statut === 'terminee' || statut === 'annulee') {
        if (chauffeurId) {
          await supabase.from('chauffeurs').update({ statut: 'actif' }).eq('id', chauffeurId)
        }
        if (statut === 'terminee') {
          const course = courses.find(c => c.id === id)
          if (course && course.tarif > 0) {
            try {
              await supabase.from('transactions').insert({
                tenant_id: tenantId,
                type: 'entree',
                categorie: 'Transport VTC',
                description: `Course ${course.depart} → ${course.arrivee} — ${course.client_nom}`,
                montant: course.tarif,
                date: course.date,
                mode_paiement: 'Espèces',
                source: 'course',
                source_id: id,
              })
            } catch {}
          }
        }
      }
    } catch {}
    load()
  }

  // ── KPIs
  const totalCourses = courses.length
  const coursesTerminees = courses.filter(c => c.statut === 'terminee').length
  const chiffreAffaires = courses.filter(c => c.statut === 'terminee').reduce((s, c) => s + c.tarif, 0)
  const chauffeursActifs = chauffeurs.filter(c => c.statut !== 'inactif').length

  const filteredCourses = filterStatut === 'all' ? courses : courses.filter(c => c.statut === filterStatut)

  return (
    <div className="space-y-5 pb-10">

      {/* ── Header ── */}
      <motion.div {...fadeUp(0)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <Truck size={20} className="text-[#DC2626]" /> {t('transport.title')}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('transport.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal('chauffeur')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs text-[var(--text-secondary)] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl hover:border-[#64748B] hover:text-[var(--text)] transition-all"
          >
            <User size={11} /> {t('transport.newDriver')}
          </button>
          <button
            onClick={() => setModal('course')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white rounded-xl hover:opacity-90 transition-all"
            style={{ background: '#DC2626' }}
          >
            <Plus size={11} /> {t('transport.newCourse')}
          </button>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 auto-rows-[120px]">
        {[
          { label: t('transport.totalCourses'),  value: totalCourses,          icon: Navigation, grad: '#0F172A', i: 0 },
          { label: t('transport.completed'),     value: coursesTerminees,      icon: CheckCircle, grad: '#7C3AED', i: 1 },
          { label: t('transport.revenue'),       value: fmtFCFA(chiffreAffaires), icon: Wallet, grad: '#DC2626', i: 2 },
          { label: t('transport.activeDrivers'), value: chauffeursActifs,      icon: Truck, grad: '#7C3AED', i: 3 },
        ].map(k => {
          const Icon = k.icon
          return (
            <motion.div key={k.label} {...fadeUp(k.i)} className="relative rounded-2xl p-4 overflow-hidden flex flex-col justify-between" style={{ background: k.grad }}>
              <div className="absolute inset-0" style={{ background: 'transparent' }} />
              <div className="relative flex items-start justify-between">
                <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">{k.label}</p>
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Icon size={16} className="text-white" />
                </div>
              </div>
              <p className="relative text-white text-2xl font-bold">{k.value}</p>
            </motion.div>
          )
        })}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-1 w-fit">
        {TABS.map((tabLabel, i) => (
          <button
            key={tabLabel}
            onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === i ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            {tabLabel}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-[#DC2626] animate-spin" />
        </div>
      )}

      {/* ── Tab: Courses ── */}
      {!loading && tab === 0 && (
        <motion.div {...fadeUp(1)} className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', ...Object.keys(STATUTS_COURSE)].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatut(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  filterStatut === s
                    ? 'border-[#DC2626] text-[#DC2626] bg-[#DC2626]/10'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border)]'
                }`}
              >
                {s === 'all' ? t('transport.allCourses') : STATUTS_COURSE[s]?.label}
              </button>
            ))}
          </div>

          {filteredCourses.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              <Truck size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('transport.noCourses')}</p>
            </div>
          ) : (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]" style={{ background: '#F9FAFB' }}>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('transport.colClient')}</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider hidden sm:table-cell">{t('transport.colRoute')}</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider hidden md:table-cell">{t('transport.colDriver')}</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('transport.colFare')}</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('transport.colStatus')}</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('transport.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((c, i) => {
                    const st = STATUTS_COURSE[c.statut]
                    return (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-[var(--border)] hover:bg-white/5/40 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold text-[var(--text)]">{c.client_nom}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                            <Phone size={9} /> {c.client_tel}
                          </p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                            <MapPin size={10} className="text-[#DC2626]" /> {c.depart}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                            <MapPin size={10} className="text-[#DC2626]" /> {c.arrivee}
                          </div>
                          {c.distance_km > 0 && <p className="text-[10px] text-[var(--text-secondary)]">{c.distance_km} km</p>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-xs text-[var(--text-secondary)]">{c.chauffeur_nom ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-bold text-[var(--text)]">{fmtFCFA(c.tarif)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: st.bg, color: st.color }}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {c.statut === 'en_attente' && (
                              <button
                                onClick={() => updateStatutCourse(c.id, 'en_cours', c.chauffeur_id)}
                                className="text-[10px] px-2 py-1 rounded-lg bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 transition-all"
                              >
                                {t('transport.start')}
                              </button>
                            )}
                            {c.statut === 'en_cours' && (
                              <button
                                onClick={() => updateStatutCourse(c.id, 'terminee', c.chauffeur_id)}
                                className="text-[10px] px-2 py-1 rounded-lg bg-[var(--surface)]/10 text-[#DC2626] hover:bg-[var(--surface)]/20 transition-all"
                              >
                                {t('transport.finish')}
                              </button>
                            )}
                            {(c.statut === 'en_attente' || c.statut === 'en_cours') && (
                              <button
                                onClick={() => updateStatutCourse(c.id, 'annulee', c.chauffeur_id)}
                                className="text-[10px] px-2 py-1 rounded-lg bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 transition-all"
                              >
                                {t('transport.cancel')}
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Tab: Chauffeurs ── */}
      {!loading && tab === 1 && (
        <motion.div {...fadeUp(1)}>
          {chauffeurs.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              <User size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('transport.noDrivers')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {chauffeurs.map((ch, i) => {
                const st = STATUTS_CHAUFFEUR[ch.statut]
                return (
                  <motion.div
                    key={ch.id}
                    {...fadeUp(i)}
                    className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 hover:border-[var(--border)] transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#DC2626]/20 flex items-center justify-center">
                          <span className="text-[#DC2626] font-bold text-sm">{ch.nom.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text)]">{ch.nom}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                            <Phone size={9} /> {ch.telephone}
                          </p>
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <Truck size={11} className="text-[var(--text-secondary)]" />
                        <span>{ch.vehicule} — {ch.plaque}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star size={11} className="text-[var(--text-secondary)]" />
                        <span>{t('transport.license')} {ch.permis}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[var(--border)] flex gap-2">
                      <button
                        onClick={async () => {
                          const next = ch.statut === 'actif' ? 'inactif' : 'actif'
                          await supabase.from('chauffeurs').update({ statut: next }).eq('id', ch.id)
                          load()
                        }}
                        className="flex-1 text-[10px] py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[#64748B] transition-all"
                      >
                        {ch.statut === 'actif' ? t('transport.disable') : t('transport.enable')}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Tab: Stats ── */}
      {!loading && tab === 2 && (
        <motion.div {...fadeUp(1)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              { label: t('transport.statsSuccessRate'), value: totalCourses > 0 ? `${Math.round((coursesTerminees / totalCourses) * 100)}%` : '—', icon: TrendingUp, color: '#0F172A' },
              { label: t('transport.statsPending'),     value: courses.filter(c => c.statut === 'en_attente').length, icon: Clock, color: '#DC2626' },
              { label: t('transport.statsCancelled'),   value: courses.filter(c => c.statut === 'annulee').length,    icon: AlertCircle, color: '#DC2626' },
            ].map((s, i) => {
              const Icon = s.icon
              return (
                <motion.div key={s.label} {...fadeUp(i)} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} style={{ color: s.color }} />
                    <p className="text-xs text-[var(--text-secondary)]">{s.label}</p>
                  </div>
                  <p className="text-2xl font-bold text-[var(--text)]">{s.value}</p>
                </motion.div>
              )
            })}
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-sm font-bold text-[var(--text)] mb-4">{t('transport.revenueByDriver')}</p>
            {chauffeurs.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] text-center py-4">{t('transport.noDriver')}</p>
            ) : (
              <div className="space-y-3">
                {chauffeurs.map(ch => {
                  const rev = courses.filter(c => c.chauffeur_id === ch.id && c.statut === 'terminee').reduce((s, c) => s + c.tarif, 0)
                  const pct = chiffreAffaires > 0 ? (rev / chiffreAffaires) * 100 : 0
                  return (
                    <div key={ch.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--text-secondary)]">{ch.nom}</span>
                        <span className="text-xs font-bold text-[var(--text)]">{fmtFCFA(rev)}</span>
                      </div>
                      <div className="h-1.5 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-[#DC2626]"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Modal: Nouvelle course ── */}
      <AnimatePresence>
        {modal === 'course' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-[var(--text)]">{t('transport.modalCourseTitle')}</h2>
                <button onClick={() => setModal(null)} className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <select
                  value={cForm.chauffeur_id}
                  onChange={e => setCForm(f => ({ ...f, chauffeur_id: e.target.value }))}
                  className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)]"
                >
                  <option value="">{t('transport.selectDriver')}</option>
                  {chauffeurs.filter(c => c.statut === 'actif').map(c => (
                    <option key={c.id} value={c.id}>{c.nom} — {c.vehicule} ({c.plaque})</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder={t('transport.clientName')} value={cForm.client_nom}
                    onChange={e => setCForm(f => ({ ...f, client_nom: e.target.value }))}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                  <input placeholder={t('transport.clientPhone')} value={cForm.client_tel}
                    onChange={e => setCForm(f => ({ ...f, client_tel: e.target.value }))}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                </div>
                <input placeholder={t('transport.departure')} value={cForm.depart}
                  onChange={e => setCForm(f => ({ ...f, depart: e.target.value }))}
                  className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                <input placeholder={t('transport.destination')} value={cForm.arrivee}
                  onChange={e => setCForm(f => ({ ...f, arrivee: e.target.value }))}
                  className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                <div className="grid grid-cols-3 gap-3">
                  <input placeholder={t('transport.distance')} type="number" value={cForm.distance_km}
                    onChange={e => setCForm(f => ({ ...f, distance_km: e.target.value }))}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                  <input placeholder={t('transport.fare')} type="number" value={cForm.tarif}
                    onChange={e => setCForm(f => ({ ...f, tarif: e.target.value }))}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                  <input type="date" value={cForm.date}
                    onChange={e => setCForm(f => ({ ...f, date: e.target.value }))}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)]" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-all">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={saveCourse}
                  disabled={saving || !cForm.chauffeur_id || !cForm.depart || !cForm.arrivee}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#DC2626' }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {t('transport.createCourse')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal: Nouveau chauffeur ── */}
      <AnimatePresence>
        {modal === 'chauffeur' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-[var(--text)]">{t('transport.modalDriverTitle')}</h2>
                <button onClick={() => setModal(null)} className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <input placeholder={t('transport.driverFullName')} value={dForm.nom}
                  onChange={e => setDForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                <input placeholder={t('transport.clientPhone')} value={dForm.telephone}
                  onChange={e => setDForm(f => ({ ...f, telephone: e.target.value }))}
                  className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                <input placeholder={t('transport.driverLicense')} value={dForm.permis}
                  onChange={e => setDForm(f => ({ ...f, permis: e.target.value }))}
                  className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder={t('transport.vehicleModel')} value={dForm.vehicule}
                    onChange={e => setDForm(f => ({ ...f, vehicule: e.target.value }))}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                  <input placeholder={t('transport.plate')} value={dForm.plaque}
                    onChange={e => setDForm(f => ({ ...f, plaque: e.target.value }))}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B]" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-all">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={saveChauffeur}
                  disabled={saving || !dForm.nom}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#DC2626' }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {t('common.save')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
