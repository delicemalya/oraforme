'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  History, Search, Download, Loader2, ArrowUpCircle, ArrowDownCircle,
  GitMerge, Filter, Calendar, Eye, X, ChevronLeft, ChevronRight,
  Building2, Archive, Smartphone, Wallet2, Tag,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  tenant_id: string
  date: string
  libelle: string
  montant: number
  type: 'entree' | 'sortie' | 'virement' | 'frais'
  categorie: string
  reference: string
  source: string
  source_id: string | null
  compte: string | null
  notes: string
  created_at: string
}

const TYPE_CONFIG: Record<string, { label: string; color: string; sign: string; icon: React.ElementType }> = {
  entree:   { label: 'Encaissement', color: 'text-green-600', sign: '+', icon: ArrowUpCircle },
  sortie:   { label: 'Décaissement', color: 'text-red-600',   sign: '-', icon: ArrowDownCircle },
  virement: { label: 'Transfert',    color: 'text-purple-600',sign: '',  icon: GitMerge },
  frais:    { label: 'Frais',        color: 'text-orange-600',sign: '-', icon: Tag },
}

const PAGE_SIZE = 50

export default function HistoriquePage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : 'fr-FR'
  const [rows, setRows]             = useState<Transaction[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(0)
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [selected, setSelected]     = useState<Transaction | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const totalEntrees  = rows.filter(r => r.type === 'entree').reduce((s, r) => s + r.montant, 0)
  const totalSorties  = rows.filter(r => r.type === 'sortie' || r.type === 'frais').reduce((s, r) => s + r.montant, 0)
  const netCashflow   = totalEntrees - totalSorties

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase.from('transactions')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filterType !== 'all') query = query.eq('type', filterType)
      if (filterSource !== 'all') query = query.eq('source', filterSource)
      if (dateFrom) query = query.gte('date', dateFrom)
      if (dateTo) query = query.lte('date', dateTo)
      if (search) query = query.ilike('libelle', `%${search}%`)

      const { data, count, error } = await query
      if (!error) {
        setRows(data ?? [])
        setTotal(count ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, filterType, filterSource, dateFrom, dateTo, search])

  useEffect(() => { setPage(0) }, [filterType, filterSource, dateFrom, dateTo, search])
  useEffect(() => { load() }, [load])

  function exportCSV() {
    const lines = ['Date,Libellé,Type,Montant,Catégorie,Source,Référence,Compte']
    rows.forEach(r => {
      const sign = TYPE_CONFIG[r.type]?.sign ?? ''
      lines.push([r.date, `"${r.libelle}"`, r.type, `${sign}${r.montant}`, r.categorie, r.source, r.reference, r.compte ?? ''].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `historique_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <History size={20} className="text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('treso.historique.title')}</h1>
            <p className="text-xs text-[#64748B]">{t('treso.historique.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-xl transition-colors ${
              showFilters ? 'bg-[#0891B2] text-white border-[#0891B2]' : 'text-[#64748B] border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}>
            <Filter size={14} /> Filtres
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
            <Download size={14} /> Exporter
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] mb-1">Entrées (page)</div>
          <div className="text-lg font-bold text-green-600">+{fmtFCFA(totalEntrees)}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] mb-1">Sorties (page)</div>
          <div className="text-lg font-bold text-red-600">-{fmtFCFA(totalSorties)}</div>
        </div>
        <div className={`bg-white border rounded-2xl p-4 ${netCashflow >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <div className="text-xs text-[#64748B] mb-1">Net (page)</div>
          <div className={`text-lg font-bold ${netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {netCashflow >= 0 ? '+' : ''}{fmtFCFA(netCashflow)}
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('treso.historique.searchPlh')}
                className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
              <option value="all">Tous types</option>
              <option value="entree">Encaissements</option>
              <option value="sortie">Décaissements</option>
              <option value="virement">Transferts</option>
              <option value="frais">Frais</option>
            </select>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
              <option value="all">Toutes sources</option>
              <option value="encaissement">Encaissements</option>
              <option value="decaissement">Décaissements</option>
              <option value="transfert">Transferts</option>
              <option value="caisse">Caisse</option>
              <option value="banque">Banque</option>
              <option value="mobile">Mobile Money</option>
              <option value="validation">Validations</option>
              <option value="remboursement">Remboursements</option>
            </select>
            <div className="flex gap-1">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="flex-1 border border-[#E2E8F0] rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="flex-1 border border-[#E2E8F0] rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
            </div>
          </div>
          {(dateFrom || dateTo || filterType !== 'all' || filterSource !== 'all' || search) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setFilterType('all'); setFilterSource('all'); setSearch('') }}
              className="flex items-center gap-1 text-xs text-red-500 hover:underline">
              <X size={12} /> Réinitialiser filtres
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#0F172A]">
            Page {page + 1}/{Math.max(totalPages, 1)} — {rows.length} lignes
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 hover:bg-[#F1F5F9] rounded-lg disabled:opacity-40 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-[#64748B] px-2">{total.toLocaleString('fr-FR')} total</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1.5 hover:bg-[#F1F5F9] rounded-lg disabled:opacity-40 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#0891B2]" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
            <History size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{t('treso.historique.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {[t('treso.historique.colDate'), t('treso.historique.colLabel'), t('treso.historique.colType'), 'Source', 'Catégorie', t('treso.historique.colMontant'), ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const tc = TYPE_CONFIG[r.type] ?? TYPE_CONFIG.sortie
                  const Icon = tc.icon
                  return (
                    <tr key={r.id} className={`border-t border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                      <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString(intlLocale)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-[#0F172A] max-w-xs truncate">{r.libelle}</div>
                        {r.reference && <div className="text-[10px] text-[#94A3B8]">Réf: {r.reference}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${tc.color}`}>
                          <Icon size={10} />
                          {tc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-lg capitalize">{r.source || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-[#94A3B8]">{r.categorie || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${tc.color}`}>
                          {tc.sign}{fmtFCFA(r.montant)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(r)} className="p-1 hover:bg-[#F1F5F9] rounded-lg">
                          <Eye size={13} className="text-[#94A3B8]" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[#E2E8F0] flex items-center justify-center gap-2">
            <button onClick={() => setPage(0)} disabled={page === 0}
              className="px-2 py-1 text-xs text-[#64748B] hover:bg-[#F1F5F9] rounded-lg disabled:opacity-40">Début</button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 hover:bg-[#F1F5F9] rounded-lg disabled:opacity-40">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-[#64748B]">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1.5 hover:bg-[#F1F5F9] rounded-lg disabled:opacity-40">
              <ChevronRight size={14} />
            </button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
              className="px-2 py-1 text-xs text-[#64748B] hover:bg-[#F1F5F9] rounded-lg disabled:opacity-40">Fin</button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Détail transaction</h3>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            {(() => {
              const tc = TYPE_CONFIG[selected.type] ?? TYPE_CONFIG.sortie
              return (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                  selected.type === 'entree' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  <tc.icon size={14} />
                  {tc.sign}{fmtFCFA(selected.montant)} — {tc.label}
                </div>
              )
            })()}
            {[
              ['Date', new Date(selected.date).toLocaleDateString(intlLocale)],
              ['Libellé', selected.libelle],
              ['Type', selected.type],
              ['Source', selected.source || '—'],
              ['Catégorie', selected.categorie || '—'],
              ['Référence', selected.reference || '—'],
              ['Compte', selected.compte || '—'],
              ['Notes', selected.notes || '—'],
              ['Créé le', new Date(selected.created_at).toLocaleDateString(intlLocale)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs gap-4">
                <span className="text-[#64748B] shrink-0">{k}</span>
                <span className="text-[#0F172A] font-medium text-right break-all">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
