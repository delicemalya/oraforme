'use client'

/**
 * GED Documents — Gestion Électronique des Documents (tous secteurs)
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useLocale } from '@/lib/hooks/useLocale'
import ERPPageLayout, {
  ERPSectionCard, ERPEmptyState, ERPStatusBadge,
  type ERPTab,
} from '@/components/ui/ERPPageLayout'
import {
  FolderOpen, Upload, Search, File, FileText,
  Image, ArchiveX, Download, Trash2, Plus, Eye,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Document {
  id:          string
  nom:         string
  type:        string
  categorie:   string
  taille?:     number
  url:         string
  statut:      'actif' | 'archive'
  created_at:  string
  created_by?: string
}

function fmtSize(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const EXT_ICONS: Record<string, React.ReactNode> = {
  pdf:  <FileText size={16} className="text-red-500" />,
  doc:  <FileText size={16} className="text-blue-600" />,
  docx: <FileText size={16} className="text-blue-600" />,
  xls:  <FileText size={16} className="text-green-600" />,
  xlsx: <FileText size={16} className="text-green-600" />,
  png:  <Image size={16} className="text-purple-500" />,
  jpg:  <Image size={16} className="text-purple-500" />,
  jpeg: <Image size={16} className="text-purple-500" />,
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GEDPage() {
  const { tenant } = useTenantContext()
  const { t } = useLocale()

  const CATEGORIES = [
    { key: 'ged.cat.all',       value: 'Tous' },
    { key: 'ged.cat.contrats',  value: 'Contrats' },
    { key: 'ged.cat.factures',  value: 'Factures' },
    { key: 'ged.cat.rh',        value: 'RH' },
    { key: 'ged.cat.compta',    value: 'Comptabilité' },
    { key: 'ged.cat.juridique', value: 'Juridique' },
    { key: 'ged.cat.commercial',value: 'Commercial' },
    { key: 'ged.cat.technique', value: 'Technique' },
    { key: 'ged.cat.autre',     value: 'Autre' },
  ]

  const [docs,     setDocs]     = useState<Document[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [cat,      setCat]      = useState('Tous')
  const [tab,      setTab]      = useState('actifs')
  const [showNew,  setShowNew]  = useState(false)

  const [form, setForm] = useState({
    nom: '', url: '', categorie: 'Autre', type: 'pdf',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenant) return
    loadDocs()
  }, [tenant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDocs() {
    setLoading(true)
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', tenant!.tenantId)
      .order('created_at', { ascending: false })
    setDocs((data ?? []) as Document[])
    setLoading(false)
  }

  async function addDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim() || !form.url.trim()) return
    setSaving(true)
    await supabase.from('documents').insert({
      tenant_id:  tenant!.tenantId,
      nom:        form.nom.trim(),
      url:        form.url.trim(),
      categorie:  form.categorie,
      type:       form.type,
      statut:     'actif',
    })
    setShowNew(false)
    setForm({ nom: '', url: '', categorie: 'Autre', type: 'pdf' })
    setSaving(false)
    loadDocs()
  }

  async function archiveDoc(id: string) {
    await supabase.from('documents').update({ statut: 'archive' }).eq('id', id)
    loadDocs()
  }

  async function deleteDoc(id: string) {
    if (!confirm(t('ged.deleteConfirm'))) return
    await supabase.from('documents').delete().eq('id', id)
    loadDocs()
  }

  const filtered = docs.filter(d => {
    const matchTab = tab === 'actifs' ? d.statut === 'actif' : d.statut === 'archive'
    const matchCat = cat === 'Tous' || d.categorie === cat
    const q        = search.toLowerCase()
    const matchQ   = !q || d.nom.toLowerCase().includes(q) || d.categorie.toLowerCase().includes(q)
    return matchTab && matchCat && matchQ
  })

  const actifCnt = docs.filter(d => d.statut === 'actif').length
  const archCnt  = docs.filter(d => d.statut === 'archive').length

  const tabsWithBadge: ERPTab[] = [
    { id: 'actifs',   label: t('ged.tabActive'),    badge: actifCnt },
    { id: 'archives', label: t('ged.tabArchives'),   badge: archCnt },
  ]

  return (
    <ERPPageLayout
      title={t('ged.title')}
      subtitle={t('ged.subtitle')}
      icon={<FolderOpen size={18} />}
      color="#64748B"
      tabs={tabsWithBadge}
      activeTab={tab}
      onTabChange={setTab}
      actions={
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F59E0B] text-white text-[13px] font-semibold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus size={14} />
          {t('ged.addBtn')}
        </button>
      }
    >
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text" placeholder={t('ged.searchPlaceholder')}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCat(c.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                cat === c.value ? 'bg-[#F59E0B] text-white' : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              {t(c.key)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-[#F1F5F9] rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <ERPSectionCard>
          <ERPEmptyState
            icon={<FolderOpen size={48} />}
            title={t('ged.noDocument')}
            description={t('ged.noDocumentDesc')}
            action={
              <button onClick={() => setShowNew(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-semibold">
                <Plus size={14} />
                {t('ged.addDocument')}
              </button>
            }
          />
        </ERPSectionCard>
      ) : (
        <ERPSectionCard>
          <div className="divide-y divide-[#E2E8F0]">
            {filtered.map(doc => {
              const ext  = doc.nom.split('.').pop()?.toLowerCase() ?? doc.type
              const icon = EXT_ICONS[ext] ?? <File size={16} className="text-[#94A3B8]" />
              return (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors group">
                  <div className="w-8 h-8 rounded-xl bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">{doc.nom}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <ERPStatusBadge status="info" label={doc.categorie} />
                      <span className="text-[11px] text-[#94A3B8]">{fmtDate(doc.created_at)}</span>
                      {doc.taille && <span className="text-[11px] text-[#94A3B8]">{fmtSize(doc.taille)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-[#64748B] hover:text-blue-600 transition-colors">
                      <Eye size={14} />
                    </a>
                    <a href={doc.url} download
                      className="p-1.5 rounded-lg hover:bg-green-50 text-[#64748B] hover:text-green-600 transition-colors">
                      <Download size={14} />
                    </a>
                    {tab === 'actifs' && (
                      <button onClick={() => archiveDoc(doc.id)}
                        title={t('ged.archiveBtn')}
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-[#64748B] hover:text-amber-600 transition-colors">
                        <ArchiveX size={14} />
                      </button>
                    )}
                    <button onClick={() => deleteDoc(doc.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </ERPSectionCard>
      )}

      {/* Modal nouveau document */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-[16px] font-bold text-[#0F172A] mb-4 flex items-center gap-2">
              <Upload size={16} className="text-[#F59E0B]" />
              {t('ged.modalTitle')}
            </h2>
            <form onSubmit={addDoc} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.nomLabel')}</label>
                <input required value={form.nom} onChange={e => setForm(p => ({...p, nom: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="Contrat_prestataire_2026.pdf" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.urlLabel')}</label>
                <input required value={form.url} onChange={e => setForm(p => ({...p, url: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.categorieLabel')}</label>
                  <select value={form.categorie} onChange={e => setForm(p => ({...p, categorie: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                    {CATEGORIES.filter(c => c.value !== 'Tous').map(c => <option key={c.value} value={c.value}>{t(c.key)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.typeLabel')}</label>
                  <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                    {['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'autre'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNew(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-semibold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? t('ged.saving') : t('ged.addSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ERPPageLayout>
  )
}
