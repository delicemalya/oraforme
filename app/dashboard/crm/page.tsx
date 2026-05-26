'use client'

/**
 * CRM Clients — page universelle (tous secteurs)
 * Gestion des clients, prospects, historique des relations.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import ERPPageLayout, {
  ERPSectionCard, ERPStatusBadge, ERPEmptyState,
  ERPDataTable, ERPKpiGrid,
  type ERPKpi, type ERPTab, type ERPColumn,
} from '@/components/ui/ERPPageLayout'
import { Users, Plus, Search, Phone, Mail, Building2, TrendingUp } from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Client extends Record<string, unknown> {
  id:             string
  nom:            string
  email?:         string
  telephone?:     string
  entreprise?:    string
  statut:         string
  type:           'client' | 'prospect' | 'inactif'
  ca_total?:      number
  created_at:     string
  derniere_visite?: string
}

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const { tenant } = useTenantContext()
  const { t } = useLocale()
  const [clients, setClients]   = useState<Client[]>([])
  const [loading, setLoading]   = useState(true)
  const [search,  setSearch]    = useState('')
  const [tab,     setTab]       = useState('tous')
  const [showNew, setShowNew]   = useState(false)

  // Form state
  const [form, setForm] = useState({
    nom: '', email: '', telephone: '', entreprise: '', type: 'client' as Client['type'],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenant) return
    loadClients()
  }, [tenant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadClients() {
    setLoading(true)
    // Try from 'clients' table, fallback to 'contacts'
    let { data } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenant!.tenantId)
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) {
      const alt = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenant!.tenantId)
        .order('created_at', { ascending: false })
      data = alt.data
    }

    setClients((data ?? []) as Client[])
    setLoading(false)
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim()) return
    setSaving(true)
    await supabase.from('clients').insert({
      tenant_id:  tenant!.tenantId,
      nom:        form.nom.trim(),
      email:      form.email.trim() || null,
      telephone:  form.telephone.trim() || null,
      entreprise: form.entreprise.trim() || null,
      type:       form.type,
      statut:     form.type === 'prospect' ? 'prospect' : 'actif',
    })
    setShowNew(false)
    setForm({ nom: '', email: '', telephone: '', entreprise: '', type: 'client' })
    setSaving(false)
    loadClients()
  }

  const filtered = clients.filter(c => {
    const matchTab = tab === 'tous' || c.type === tab.replace('s', '').replace('ifs', 'if') ||
      (tab === 'clients' && c.type === 'client') ||
      (tab === 'prospects' && c.type === 'prospect') ||
      (tab === 'inactifs' && c.type === 'inactif')
    const q = search.toLowerCase()
    const matchSearch = !q || c.nom.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.entreprise?.toLowerCase().includes(q) ||
      c.telephone?.includes(q)
    return matchTab && matchSearch
  })

  const nbClients   = clients.filter(c => c.type === 'client').length
  const nbProspects = clients.filter(c => c.type === 'prospect').length
  const nbInactifs  = clients.filter(c => c.type === 'inactif').length
  const caTotal     = clients.reduce((s, c) => s + (c.ca_total ?? 0), 0)

  const kpis: ERPKpi[] = [
    { label: t('crm.activeClients'),   value: nbClients,        color: '#16A34A', icon: <Users size={16} /> },
    { label: t('crm.prospects'),       value: nbProspects,      color: '#F59E0B', icon: <TrendingUp size={16} /> },
    { label: t('crm.inactiveClients'), value: nbInactifs,       color: '#64748B', icon: <Building2 size={16} /> },
    { label: t('crm.caGenerated'),     value: fmtFCFA(caTotal), color: '#2563EB', icon: <TrendingUp size={16} /> },
  ]

  const tabsWithBadge: ERPTab[] = [
    { id: 'tous',      label: t('crm.allClients'),   badge: clients.length },
    { id: 'clients',   label: t('crm.activeClients'), badge: nbClients },
    { id: 'prospects', label: t('crm.prospects'),     badge: nbProspects },
    { id: 'inactifs',  label: t('crm.inactifs'),      badge: nbInactifs },
  ]

  const columns: ERPColumn<Client>[] = [
    { key: 'nom',        label: t('common.name'),     render: r => (
      <div>
        <p className="font-semibold text-[#0F172A] text-[13px]">{r.nom}</p>
        {r.entreprise && <p className="text-[11px] text-[#64748B]">{r.entreprise}</p>}
      </div>
    )},
    { key: 'contact',    label: t('crm.contact'),     render: r => (
      <div className="space-y-0.5">
        {r.email     && <p className="text-[12px] flex items-center gap-1"><Mail size={11} className="text-[#94A3B8]"/>{r.email}</p>}
        {r.telephone && <p className="text-[12px] flex items-center gap-1"><Phone size={11} className="text-[#94A3B8]"/>{r.telephone}</p>}
      </div>
    )},
    { key: 'type',       label: t('crm.typeLabel'),   render: r => (
      <ERPStatusBadge
        status={r.type === 'client' ? 'active' : r.type === 'prospect' ? 'pending' : 'inactive'}
        label={r.type === 'client' ? t('crm.typeClient') : r.type === 'prospect' ? t('crm.typeProspect') : t('crm.typeInactif')}
      />
    )},
    { key: 'ca_total',   label: t('crm.caGenerated'), render: r => (
      <span className="font-semibold text-[#0F172A] tabular-nums text-[13px]">
        {r.ca_total ? fmtFCFA(r.ca_total) : '—'}
      </span>
    )},
    { key: 'created_at', label: t('crm.entryDate'),   render: r => (
      <span className="text-[12px] text-[#64748B]">{fmtDate(r.created_at)}</span>
    )},
  ]

  return (
    <ERPPageLayout
      title={t('crm.title')}
      subtitle={t('crm.subtitle')}
      icon={<Users size={18} />}
      color="#F59E0B"
      kpis={kpis}
      tabs={tabsWithBadge}
      activeTab={tab}
      onTabChange={setTab}
      actions={
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F59E0B] text-white text-[13px] font-semibold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus size={14} />
          {t('crm.newClient')}
        </button>
      }
    >
      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          placeholder={t('crm.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
        />
      </div>

      {/* Table */}
      <ERPSectionCard>
        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-[#F1F5F9] rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <ERPDataTable
            columns={columns}
            rows={filtered}
            emptyLabel={t('crm.noClient')}
          />
        )}
      </ERPSectionCard>

      {/* Nouveau client modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-[16px] font-bold text-[#0F172A] mb-4">{t('crm.newClientTitle')}</h2>
            <form onSubmit={createClient} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('crm.fullName')}</label>
                <input required value={form.nom} onChange={e => setForm(p => ({...p, nom: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="Jean Dupont" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('crm.company')}</label>
                <input value={form.entreprise} onChange={e => setForm(p => ({...p, entreprise: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="SARL Exemple" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('common.email')}</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="jean@email.com" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('common.phone')}</label>
                  <input value={form.telephone} onChange={e => setForm(p => ({...p, telephone: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="+243..." />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('crm.typeLabel')}</label>
                <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value as Client['type']}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                  <option value="client">{t('crm.typeClientActif')}</option>
                  <option value="prospect">{t('crm.typeProspect')}</option>
                  <option value="inactif">{t('crm.typeInactif')}</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNew(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-semibold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? t('common.saving') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ERPPageLayout>
  )
}
