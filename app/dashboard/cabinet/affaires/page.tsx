'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  Scale, Plus, Search, X, ChevronDown,
  Calendar, FileText, AlertTriangle, CheckCircle2,
  Loader2, Eye,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Affaire {
  id: string
  reference: string
  intitule: string
  type_affaire: string
  client_nom: string
  client_id: string | null
  partie_adverse: string | null
  juridiction: string | null
  numero_dossier: string | null
  date_ouverture: string
  date_audience: string | null
  statut: string
  priorite: string
  honoraires_provision: number
  honoraires_facture: number
  description: string | null
  notes: string | null
  created_at: string
}

interface Audience {
  id: string
  affaire_id: string
  affaire_ref: string
  affaire_intitule: string
  date_audience: string
  heure: string | null
  juridiction: string
  type_audience: string
  statut: string
  notes: string | null
}

// ── Configs ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  civil:          { label: 'Civil',           color: '#2563EB' },
  penal:          { label: 'Pénal',           color: '#DC2626' },
  commercial:     { label: 'Commercial',      color: '#D97706' },
  social:         { label: 'Social / Prud.',  color: '#16A34A' },
  administratif:  { label: 'Administratif',   color: '#7C3AED' },
  foncier:        { label: 'Foncier',         color: '#0891B2' },
  famille:        { label: 'Famille',         color: '#DB2777' },
  conseil:        { label: 'Conseil / Rédac', color: '#64748B' },
}

const STATUT_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ouvert:              { label: 'En cours',        bg: '#EFF6FF', text: '#1D4ED8' },
  instruction:         { label: 'Instruction',     bg: '#FFFBEB', text: '#B45309' },
  audience_programmee: { label: 'Audience prév.',  bg: '#F0FDF4', text: '#16A34A' },
  delibere:            { label: 'Délibéré',        bg: '#FEF3C7', text: '#92400E' },
  gagne:               { label: 'Gagné',           bg: '#F0FDF4', text: '#15803D' },
  perdu:               { label: 'Perdu',           bg: '#FEF2F2', text: '#B91C1C' },
  transaction:         { label: 'Transactionnel',  bg: '#F5F3FF', text: '#6D28D9' },
  classe_sans_suite:   { label: 'Classé s/suite',  bg: '#F8FAFC', text: '#64748B' },
  archive:             { label: 'Archivé',         bg: '#F8FAFC', text: '#94A3B8' },
}

const PRIORITE_CONFIG: Record<string, { label: string; color: string }> = {
  urgent:  { label: 'Urgent',  color: '#DC2626' },
  haute:   { label: 'Haute',   color: '#F59E0B' },
  normale: { label: 'Normale', color: '#64748B' },
  basse:   { label: 'Basse',   color: '#94A3B8' },
}

const EMPTY_FORM = {
  intitule: '', type_affaire: 'civil', client_nom: '', partie_adverse: '',
  juridiction: '', numero_dossier: '', date_audience: '', statut: 'ouvert',
  priorite: 'normale', honoraires_provision: 0, description: '', notes: '',
}

const INPUT = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15 bg-white transition-all'
const LABEL = 'block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5'

// ── Helpers ───────────────────────────────────────────────────────────────────

function jours(date: string) {
  const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  if (d < 0)   return { text: `${Math.abs(d)}j passé`, color: '#DC2626' }
  if (d === 0) return { text: "Aujourd'hui", color: '#DC2626' }
  if (d <= 7)  return { text: `J-${d}`, color: '#D97706' }
  return { text: `J-${d}`, color: '#2563EB' }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AffairesPage() {
  const { tenant } = useTenantContext()
  const tenantId = tenant?.tenantId ?? ''

  const [affaires,   setAffaires]   = useState<Affaire[]>([])
  const [audiences,  setAudiences]  = useState<Audience[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStat, setFilterStat] = useState('')
  const [showModal,  setShowModal]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [form,       setForm]       = useState({ ...EMPTY_FORM })
  const [detail,     setDetail]     = useState<Affaire | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [affRes, audRes] = await Promise.all([
        supabase.from('cabinet_affaires')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        supabase.from('cabinet_audiences')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('date_audience', new Date().toISOString().split('T')[0])
          .order('date_audience', { ascending: true })
          .limit(10),
      ])
      setAffaires((affRes.data ?? []) as Affaire[])
      setAudiences((audRes.data ?? []) as Audience[])
    } catch { /* tables may not exist yet */ }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.intitule.trim() || !form.client_nom.trim()) {
      setError('Intitulé et client sont obligatoires.')
      return
    }
    setSaving(true); setError('')
    const ref = `AFF-${Date.now().toString(36).toUpperCase()}`
    const { error: err } = await supabase.from('cabinet_affaires').insert({
      tenant_id:           tenantId,
      reference:           ref,
      intitule:            form.intitule.trim(),
      type_affaire:        form.type_affaire,
      client_nom:          form.client_nom.trim(),
      partie_adverse:      form.partie_adverse.trim() || null,
      juridiction:         form.juridiction.trim() || null,
      numero_dossier:      form.numero_dossier.trim() || null,
      date_ouverture:      new Date().toISOString().split('T')[0],
      date_audience:       form.date_audience || null,
      statut:              form.statut,
      priorite:            form.priorite,
      honoraires_provision: Number(form.honoraires_provision) || 0,
      honoraires_facture:  0,
      description:         form.description.trim() || null,
      notes:               form.notes.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false)
    setForm({ ...EMPTY_FORM })
    load()
  }

  // ── Filtered ───────────────────────────────────────────────────────────────

  const filtered = affaires.filter(a => {
    const q = search.toLowerCase()
    if (q && !a.intitule.toLowerCase().includes(q) && !a.client_nom.toLowerCase().includes(q) && !a.reference.toLowerCase().includes(q)) return false
    if (filterType && a.type_affaire !== filterType) return false
    if (filterStat && a.statut !== filterStat) return false
    return true
  })

  const kpis = {
    total:    affaires.length,
    enCours:  affaires.filter(a => ['ouvert','instruction','audience_programmee','delibere'].includes(a.statut)).length,
    urgent:   affaires.filter(a => a.priorite === 'urgent').length,
    provisions: affaires.reduce((s, a) => s + a.honoraires_provision, 0),
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A]">Affaires & Dossiers</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Gestion des dossiers judiciaires et procédures</p>
        </div>
        <button onClick={() => { setShowModal(true); setError('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 shrink-0"
          style={{ background: '#F59E0B' }}>
          <Plus size={15} /> Nouvelle affaire
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total dossiers',   value: kpis.total,    icon: FileText, color: '#2563EB' },
          { label: 'En cours',         value: kpis.enCours,  icon: Scale,    color: '#F59E0B' },
          { label: 'Urgents',          value: kpis.urgent,   icon: AlertTriangle, color: '#DC2626' },
          { label: 'Provisions (FCFA)',
            value: kpis.provisions.toLocaleString('fr-FR'),
            icon: CheckCircle2, color: '#16A34A' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: k.color + '15' }}>
                <k.icon size={15} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] font-semibold text-[#64748B]">{k.label}</span>
            </div>
            <p className="text-[22px] font-bold text-[#0F172A]">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Prochaines audiences */}
      {audiences.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center gap-2">
            <Calendar size={15} className="text-[#F59E0B]" />
            <h2 className="text-[14px] font-bold text-[#0F172A]">Prochaines audiences</h2>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {audiences.map(aud => {
              const j = jours(aud.date_audience)
              return (
                <div key={aud.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="text-[11px] font-bold px-2 py-1 rounded-lg"
                    style={{ background: j.color + '18', color: j.color }}>
                    {j.text}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">{aud.affaire_intitule}</p>
                    <p className="text-[11px] text-[#64748B]">{aud.juridiction} {aud.heure ? `· ${aud.heure}` : ''}</p>
                  </div>
                  <span className="text-[11px] text-[#94A3B8] shrink-0">
                    {new Date(aud.date_audience).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtres + recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text" placeholder="Rechercher une affaire, client…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15 bg-white"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="pl-3 pr-8 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl text-[#0F172A] outline-none focus:border-[#F59E0B] bg-white appearance-none cursor-pointer">
              <option value="">Tout type</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterStat} onChange={e => setFilterStat(e.target.value)}
              className="pl-3 pr-8 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl text-[#0F172A] outline-none focus:border-[#F59E0B] bg-white appearance-none cursor-pointer">
              <option value="">Tout statut</option>
              {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#94A3B8]">
            <Loader2 size={22} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Scale size={36} className="mx-auto mb-3 text-[#CBD5E1]" />
            <p className="text-[14px] font-semibold text-[#64748B]">
              {affaires.length === 0 ? 'Aucun dossier enregistré' : 'Aucun résultat'}
            </p>
            {affaires.length === 0 && (
              <p className="text-[12px] text-[#94A3B8] mt-1">Créez votre premier dossier judiciaire.</p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    {['Référence', 'Intitulé', 'Type', 'Client', 'Prochaine aud.', 'Priorité', 'Statut', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => {
                    const sc = STATUT_CONFIG[a.statut] ?? STATUT_CONFIG.ouvert
                    const pc = PRIORITE_CONFIG[a.priorite] ?? PRIORITE_CONFIG.normale
                    const tc = TYPE_LABELS[a.type_affaire]
                    return (
                      <tr key={a.id} className="border-b border-[#F8FAFC] hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-[12px] font-mono font-bold text-[#64748B]">{a.reference}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[13px] font-semibold text-[#0F172A] max-w-[200px] truncate">{a.intitule}</p>
                          {a.partie_adverse && (
                            <p className="text-[11px] text-[#94A3B8] truncate">c/ {a.partie_adverse}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                            style={{ background: (tc?.color ?? '#64748B') + '18', color: tc?.color ?? '#64748B' }}>
                            {tc?.label ?? a.type_affaire}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#374151]">{a.client_nom}</td>
                        <td className="px-4 py-3">
                          {a.date_audience ? (
                            <span className="text-[12px] font-semibold" style={{ color: jours(a.date_audience).color }}>
                              {new Date(a.date_audience).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          ) : <span className="text-[#CBD5E1] text-[12px]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-bold" style={{ color: pc.color }}>{pc.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                            style={{ background: sc.bg, color: sc.text }}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setDetail(a)}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F59E0B] hover:bg-[#FFFBEB] transition-colors">
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#F8FAFC]">
              {filtered.map(a => {
                const sc = STATUT_CONFIG[a.statut] ?? STATUT_CONFIG.ouvert
                const tc = TYPE_LABELS[a.type_affaire]
                return (
                  <div key={a.id} className="p-4" onClick={() => setDetail(a)}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[#0F172A] truncate">{a.intitule}</p>
                        <p className="text-[11px] text-[#64748B]">{a.client_nom} · <span className="font-mono">{a.reference}</span></p>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                        style={{ background: (tc?.color ?? '#64748B') + '18', color: tc?.color ?? '#64748B' }}>
                        {tc?.label ?? a.type_affaire}
                      </span>
                      {a.date_audience && (
                        <span className="text-[11px] font-semibold" style={{ color: jours(a.date_audience).color }}>
                          Aud. {new Date(a.date_audience).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modal nouvelle affaire ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
              <h3 className="text-[15px] font-bold text-[#0F172A]">Nouvelle affaire</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg transition-colors">
                <X size={15} className="text-[#64748B]" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-xl text-[12px] text-red-700"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>{error}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={LABEL}>Intitulé de l&apos;affaire <span className="text-red-500">*</span></label>
                  <input type="text" value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))}
                    placeholder="ex: Dupont c/ SARL Bâtisseur — litige commercial" className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Type d&apos;affaire</label>
                  <select value={form.type_affaire} onChange={e => setForm(f => ({ ...f, type_affaire: e.target.value }))}
                    className={INPUT}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL}>Priorité</label>
                  <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                    className={INPUT}>
                    {Object.entries(PRIORITE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL}>Client <span className="text-red-500">*</span></label>
                  <input type="text" value={form.client_nom} onChange={e => setForm(f => ({ ...f, client_nom: e.target.value }))}
                    placeholder="Nom du client" className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Partie adverse</label>
                  <input type="text" value={form.partie_adverse} onChange={e => setForm(f => ({ ...f, partie_adverse: e.target.value }))}
                    placeholder="Nom de la partie adverse" className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Juridiction</label>
                  <input type="text" value={form.juridiction} onChange={e => setForm(f => ({ ...f, juridiction: e.target.value }))}
                    placeholder="ex: TGI Brazzaville" className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>N° Dossier juridiction</label>
                  <input type="text" value={form.numero_dossier} onChange={e => setForm(f => ({ ...f, numero_dossier: e.target.value }))}
                    placeholder="Numéro du rôle" className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Prochaine audience</label>
                  <input type="date" value={form.date_audience} onChange={e => setForm(f => ({ ...f, date_audience: e.target.value }))}
                    className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Provision honoraires (FCFA)</label>
                  <input type="number" min={0} value={form.honoraires_provision}
                    onChange={e => setForm(f => ({ ...f, honoraires_provision: Number(e.target.value) }))}
                    className={INPUT} />
                </div>

                <div className="sm:col-span-2">
                  <label className={LABEL}>Description</label>
                  <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Résumé des faits, objet du litige…"
                    className={INPUT + ' resize-none'} />
                </div>

                <div className="sm:col-span-2">
                  <label className={LABEL}>Notes internes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Observations, stratégie, points d'attention…"
                    className={INPUT + ' resize-none'} />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-3 shrink-0">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#F59E0B' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Panneau détail affaire ────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white w-full sm:w-[480px] h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-[15px] font-bold text-[#0F172A] truncate max-w-[320px]">{detail.intitule}</h3>
                <p className="text-[11px] font-mono text-[#94A3B8]">{detail.reference}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg transition-colors shrink-0">
                <X size={15} className="text-[#64748B]" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const sc = STATUT_CONFIG[detail.statut] ?? STATUT_CONFIG.ouvert
                  const tc = TYPE_LABELS[detail.type_affaire]
                  const pc = PRIORITE_CONFIG[detail.priorite]
                  return (
                    <>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: (tc?.color ?? '#64748B') + '18', color: tc?.color ?? '#64748B' }}>
                        {tc?.label ?? detail.type_affaire}
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: pc?.color ?? '#64748B' }}>● {pc?.label}</span>
                    </>
                  )
                })()}
              </div>

              {/* Infos */}
              {[
                { label: 'Client',           value: detail.client_nom },
                { label: 'Partie adverse',   value: detail.partie_adverse },
                { label: 'Juridiction',      value: detail.juridiction },
                { label: 'N° dossier',       value: detail.numero_dossier },
                { label: 'Prochaine aud.',   value: detail.date_audience
                    ? new Date(detail.date_audience).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                    : null },
                { label: 'Ouvert le',        value: new Date(detail.date_ouverture).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) },
                { label: 'Provision honor.', value: detail.honoraires_provision
                    ? `${detail.honoraires_provision.toLocaleString('fr-FR')} FCFA`
                    : null },
              ].filter(r => r.value).map(r => (
                <div key={r.label} className="flex items-start gap-3">
                  <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide w-32 shrink-0 pt-0.5">{r.label}</span>
                  <span className="text-[13px] text-[#0F172A] flex-1">{r.value}</span>
                </div>
              ))}

              {detail.description && (
                <div>
                  <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-2">Description</p>
                  <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">{detail.description}</p>
                </div>
              )}
              {detail.notes && (
                <div>
                  <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-2">Notes internes</p>
                  <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">{detail.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
