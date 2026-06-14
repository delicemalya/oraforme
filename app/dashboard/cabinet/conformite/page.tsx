'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  CheckCircle, AlertTriangle, Clock, RefreshCw, Loader2,
  ChevronDown, ChevronRight, Building2, ShieldCheck, X,
  TrendingUp, FileText, Calendar, Search, Filter,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckItem {
  id:       string
  label:    string
  categorie: string
}

interface ConformiteClient {
  client_id:     string
  client_nom:    string
  statut_global: string
  checks:        Record<string, boolean>
  score:         number
  derniere_maj:  string | null
}

// ── Checklist référentielle OHADA/Congo ───────────────────────────────────────

const CHECKLIST: CheckItem[] = [
  // Comptabilité
  { id: 'grand_livre',     label: 'Grand livre à jour',                    categorie: 'Comptabilité' },
  { id: 'balance',         label: 'Balance de vérification mensuelle',     categorie: 'Comptabilité' },
  { id: 'rapprochement',   label: 'Rapprochement bancaire effectué',       categorie: 'Comptabilité' },
  { id: 'caisse',          label: 'Caisse réconciliée',                    categorie: 'Comptabilité' },
  { id: 'bilan_annuel',    label: 'Bilan SYSCOHADA préparé',               categorie: 'Comptabilité' },
  // Fiscal
  { id: 'tva_mensuelle',   label: 'Déclaration TVA mensuelle déposée',     categorie: 'Fiscal' },
  { id: 'is_acompte',      label: 'Acompte IS versé',                      categorie: 'Fiscal' },
  { id: 'is_annuel',       label: 'Liasse fiscale IS déposée',             categorie: 'Fiscal' },
  { id: 'patente',         label: 'Patente annuelle réglée',               categorie: 'Fiscal' },
  { id: 'retenue_source',  label: 'Retenue à la source déclarée',          categorie: 'Fiscal' },
  // Social / RH
  { id: 'cnss_mensuel',    label: 'CNSS mensuelle déclarée & payée',       categorie: 'Social / RH' },
  { id: 'irpp',            label: 'IRPP employés déclaré',                 categorie: 'Social / RH' },
  { id: 'bulletins_paie',  label: 'Bulletins de paie remis aux employés',  categorie: 'Social / RH' },
  { id: 'contrats_signe',  label: 'Contrats de travail signés & archivés', categorie: 'Social / RH' },
  // Juridique
  { id: 'pv_ag',           label: "PV d'assemblée générale annuelle",      categorie: 'Juridique' },
  { id: 'registre_comm',   label: 'RCCM à jour',                           categorie: 'Juridique' },
  { id: 'statuts',         label: 'Statuts déposés & conformes',           categorie: 'Juridique' },
  { id: 'immatriculation', label: 'NIU valide & à jour',                   categorie: 'Juridique' },
  // Documents
  { id: 'ged_classe',      label: 'Documents GED classés & indexés',       categorie: 'Documents' },
  { id: 'contrats_clt',    label: 'Contrats clients archivés',             categorie: 'Documents' },
  { id: 'factures_archivees', label: 'Factures 5 ans conservées',          categorie: 'Documents' },
]

const CATEGORIES = [...new Set(CHECKLIST.map(c => c.categorie))]

function scoreColor(score: number) {
  if (score >= 85) return { color: '#16A34A', bg: '#F0FDF4', label: 'Conforme' }
  if (score >= 60) return { color: '#F59E0B', bg: '#FFFBEB', label: 'À surveiller' }
  return { color: '#DC2626', bg: '#FEF2F2', label: 'Non conforme' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CabinetConformitePage() {
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [clients, setClients]         = useState<ConformiteClient[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [saving, setSaving]           = useState<string | null>(null)
  const [filterScore, setFilterScore] = useState<'tous' | 'conforme' | 'surveiller' | 'nonconforme'>('tous')

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    // Fetch clients + leur conformité
    const { data: cl } = await supabase
      .from('cabinet_clients')
      .select('id, nom_entreprise, statut')
      .eq('cabinet_tenant_id', tid)
      .in('statut', ['actif', 'prospect'])
      .order('nom_entreprise')

    const { data: conf } = await supabase
      .from('cabinet_conformite')
      .select('*')
      .eq('cabinet_tenant_id', tid)

    const confMap: Record<string, Record<string, boolean>> = {}
    for (const c of (conf ?? [])) {
      confMap[c.client_id] = c.checks ?? {}
    }

    const result: ConformiteClient[] = (cl ?? []).map(c => {
      const checks = confMap[c.id] ?? {}
      const done = CHECKLIST.filter(item => checks[item.id] === true).length
      const score = Math.round((done / CHECKLIST.length) * 100)
      return {
        client_id:    c.id,
        client_nom:   c.nom_entreprise,
        statut_global: c.statut,
        checks,
        score,
        derniere_maj: (conf ?? []).find(x => x.client_id === c.id)?.updated_at ?? null,
      }
    })
    setClients(result)
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  async function toggleCheck(clientId: string, checkId: string, current: boolean) {
    setSaving(`${clientId}-${checkId}`)
    const client = clients.find(c => c.client_id === clientId)
    const newChecks = { ...(client?.checks ?? {}), [checkId]: !current }
    await supabase.from('cabinet_conformite').upsert({
      cabinet_tenant_id: tid,
      client_id:         clientId,
      checks:            newChecks,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'cabinet_tenant_id,client_id' })
    setClients(prev => prev.map(c => {
      if (c.client_id !== clientId) return c
      const done = CHECKLIST.filter(item => (newChecks)[item.id] === true).length
      return { ...c, checks: newChecks, score: Math.round((done / CHECKLIST.length) * 100) }
    }))
    setSaving(null)
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.client_nom.toLowerCase().includes(q)
    const sc = scoreColor(c.score)
    const matchF = filterScore === 'tous'
      || (filterScore === 'conforme'    && c.score >= 85)
      || (filterScore === 'surveiller'  && c.score >= 60 && c.score < 85)
      || (filterScore === 'nonconforme' && c.score < 60)
    return matchQ && matchF
  })

  const avgScore    = clients.length ? Math.round(clients.reduce((s, c) => s + c.score, 0) / clients.length) : 0
  const nbConformes = clients.filter(c => c.score >= 85).length
  const nbRisque    = clients.filter(c => c.score < 60).length

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/cabinet" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← Cabinet</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-amber-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Conformité clients</h1>
            </div>
          </div>
          <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Score moyen',    value: `${avgScore}%`,           color: scoreColor(avgScore).color,  sub: 'Portefeuille' },
            { label: 'Conformes',      value: nbConformes,              color: '#16A34A',                    sub: 'Score ≥ 85%' },
            { label: 'À surveiller',   value: clients.filter(c => c.score >= 60 && c.score < 85).length, color: '#F59E0B', sub: 'Score 60-84%' },
            { label: 'Non conformes',  value: nbRisque,                 color: '#DC2626',                    sub: 'Score < 60%' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{k.label}</p>
              <p className="text-[20px] font-black" style={{ color: k.color }}>{k.value}</p>
              <p className="text-[10px] text-[#94A3B8]">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          </div>
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {([
              { id: 'tous',        label: `Tous (${clients.length})` },
              { id: 'conforme',    label: '✅ Conformes' },
              { id: 'surveiller',  label: '⚠️ À surveiller' },
              { id: 'nonconforme', label: '❌ Risque' },
            ] as const).map(f => (
              <button key={f.id} onClick={() => setFilterScore(f.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${filterScore === f.id ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste clients + checklists */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(client => {
              const sc = scoreColor(client.score)
              const isExpanded = expanded === client.client_id
              const doneCount = CHECKLIST.filter(item => client.checks[item.id]).length

              return (
                <div key={client.client_id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  {/* Header client */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : client.client_id)}
                    className="w-full flex items-center justify-between px-4 sm:px-5 py-4 hover:bg-[#F8FAFC] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl text-white font-black text-[12px] flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-400 to-amber-600">
                        {client.client_nom.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <Link href={`/dashboard/cabinet/clients/${client.client_id}`}
                          onClick={e => e.stopPropagation()}
                          className="font-bold text-[13px] text-[#0F172A] hover:text-amber-700">{client.client_nom}</Link>
                        <p className="text-[11px] text-[#94A3B8]">{doneCount}/{CHECKLIST.length} points validés</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Score badge */}
                      <div className="flex items-center gap-2">
                        <div className="w-28 h-2 bg-[#F1F5F9] rounded-full hidden sm:block overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${client.score}%`, background: sc.color }} />
                        </div>
                        <span className="text-[13px] font-black tabular-nums" style={{ color: sc.color }}>{client.score}%</span>
                        <span className="hidden sm:block text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </div>
                      {isExpanded ? <ChevronDown size={15} className="text-[#94A3B8]" /> : <ChevronRight size={15} className="text-[#94A3B8]" />}
                    </div>
                  </button>

                  {/* Checklist dépliée */}
                  {isExpanded && (
                    <div className="border-t border-[#F1F5F9] px-4 sm:px-5 py-4 space-y-5">
                      {CATEGORIES.map(cat => {
                        const items = CHECKLIST.filter(c => c.categorie === cat)
                        const doneInCat = items.filter(item => client.checks[item.id]).length
                        return (
                          <div key={cat}>
                            <div className="flex items-center justify-between mb-2.5">
                              <p className="text-[12px] font-black text-[#374151]">{cat}</p>
                              <span className="text-[10px] text-[#94A3B8]">{doneInCat}/{items.length}</span>
                            </div>
                            <div className="space-y-2">
                              {items.map(item => {
                                const checked  = client.checks[item.id] === true
                                const isSaving = saving === `${client.client_id}-${item.id}`
                                return (
                                  <button key={item.id}
                                    onClick={() => toggleCheck(client.client_id, item.id, checked)}
                                    disabled={!!saving}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                      checked
                                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                                        : 'bg-white border-[#E2E8F0] hover:border-amber-300 hover:bg-amber-50'
                                    } disabled:opacity-60`}>
                                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                                      checked ? 'bg-green-500 border-green-500' : 'border-[#CBD5E1] bg-white'
                                    }`}>
                                      {isSaving ? (
                                        <Loader2 size={10} className="animate-spin text-white" />
                                      ) : checked ? (
                                        <CheckCircle size={11} className="text-white" />
                                      ) : null}
                                    </div>
                                    <span className={`text-[12px] font-semibold ${checked ? 'text-green-800 line-through opacity-70' : 'text-[#374151]'}`}>
                                      {item.label}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9]">
                        <p className="text-[11px] text-[#94A3B8]">
                          {client.derniere_maj ? `Mis à jour: ${new Date(client.derniere_maj).toLocaleDateString('fr-FR')}` : 'Jamais mis à jour'}
                        </p>
                        <Link href={`/dashboard/cabinet/clients/${client.client_id}`}
                          className="flex items-center gap-1 text-[12px] font-semibold text-amber-700 hover:underline">
                          Dossier client <ChevronRight size={12} />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
                <ShieldCheck size={40} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="font-bold text-[#0F172A]">Aucun client trouvé</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
