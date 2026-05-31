'use client'

/**
 * Documents RH — HR document management
 * Contrats, bulletins, attestations, diplômes, CNI, etc.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import {
  FolderOpen, Plus, X, Trash2, Download, Eye,
  FileText, Search, Archive, RefreshCw,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────── */
interface Employe { id: string; nom: string; poste: string }

interface DocumentRH {
  id: string
  tenant_id: string
  employe_id: string | null
  categorie: string
  titre: string
  url: string | null
  taille_ko: number | null
  extension: string | null
  statut: string
  date_document: string | null
  expiration: string | null
  notes: string | null
  employes?: { nom: string; poste: string } | null
  created_at: string
}

/* ─── Config ─────────────────────────────────────────────── */
const CATEGORIES = [
  { value: 'contrat',       label: 'Contrats',       icon: '📄', color: '#2563EB' },
  { value: 'bulletin',      label: 'Bulletins',      icon: '💰', color: '#16A34A' },
  { value: 'attestation',   label: 'Attestations',   icon: '📋', color: '#F59E0B' },
  { value: 'diplome',       label: 'Diplômes',       icon: '🎓', color: '#8B5CF6' },
  { value: 'identite',      label: 'Pièces d\'identité', icon: '🪪', color: '#0891B2' },
  { value: 'medical',       label: 'Documents médicaux', icon: '🏥', color: '#DC2626' },
  { value: 'evaluation',    label: 'Évaluations',    icon: '⭐', color: '#D97706' },
  { value: 'formation',     label: 'Formations',     icon: '📚', color: '#EC4899' },
  { value: 'autre',         label: 'Autres',         icon: '📁', color: '#64748B' },
]

const EXT_ICONS: Record<string, { icon: string; color: string }> = {
  pdf:  { icon: '📕', color: '#DC2626' },
  doc:  { icon: '📘', color: '#2563EB' },
  docx: { icon: '📘', color: '#2563EB' },
  xls:  { icon: '📗', color: '#16A34A' },
  xlsx: { icon: '📗', color: '#16A34A' },
  png:  { icon: '🖼️', color: '#8B5CF6' },
  jpg:  { icon: '🖼️', color: '#8B5CF6' },
  jpeg: { icon: '🖼️', color: '#8B5CF6' },
}

function getExt(filename: string | null) {
  if (!filename) return 'fichier'
  return filename.split('.').pop()?.toLowerCase() || 'fichier'
}

function fmtDate(d: string, intlLocale: string) {
  return new Date(d).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpiringSoon(expiration: string | null) {
  if (!expiration) return false
  const diff = new Date(expiration).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
}

function isExpired(expiration: string | null) {
  if (!expiration) return false
  return new Date(expiration).getTime() < Date.now()
}

const EMPTY_FORM = {
  employe_id:    '',
  categorie:     'contrat',
  titre:         '',
  url:           '',
  extension:     '',
  taille_ko:     '',
  date_document: new Date().toISOString().slice(0, 10),
  expiration:    '',
  notes:         '',
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function DocumentsRHPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale
  const [documents, setDocuments]   = useState<DocumentRH[]>([])
  const [employes, setEmployes]     = useState<Employe[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState('all')
  const [showArchived, setShowArchived] = useState(false)

  /* Load */
  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [docR, empR] = await Promise.all([
        supabase
          .from('documents_rh')
          .select('*, employes(nom, poste)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        supabase
          .from('employes')
          .select('id, nom, poste')
          .eq('tenant_id', tenantId)
          .eq('statut', 'actif')
          .order('nom'),
      ])
      if (docR.error?.code !== '42P01') setDocuments(docR.data || [])
      setEmployes(empR.data || [])
      setLoading(false)
    })()
  }, [tenantId])

  async function handleSave() {
    if (!tenantId || !form.titre.trim()) {
      setError('Titre obligatoire')
      return
    }
    setSaving(true)
    setError(null)

    // Detect extension from URL if not set
    const ext = form.extension || getExt(form.url || null)

    const { error: err } = await supabase.from('documents_rh').insert({
      tenant_id:     tenantId,
      employe_id:    form.employe_id || null,
      categorie:     form.categorie,
      titre:         form.titre.trim(),
      url:           form.url.trim() || null,
      extension:     ext || null,
      taille_ko:     form.taille_ko ? Number(form.taille_ko) : null,
      date_document: form.date_document || null,
      expiration:    form.expiration || null,
      notes:         form.notes.trim() || null,
      statut:        'actif',
    })
    if (err) { setError(err.message); setSaving(false); return }

    const { data } = await supabase
      .from('documents_rh').select('*, employes(nom, poste)')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setDocuments(data || [])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
  }

  async function handleArchive(id: string, current: string) {
    const next = current === 'actif' ? 'archive' : 'actif'
    await supabase.from('documents_rh').update({ statut: next }).eq('id', id).eq('tenant_id', tenantId)
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, statut: next } : d))
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce document ?')) return
    await supabase.from('documents_rh').delete().eq('id', id).eq('tenant_id', tenantId)
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  /* Filtered list */
  const visible = documents.filter(d => {
    if (!showArchived && d.statut === 'archive') return false
    if (filterCat !== 'all' && d.categorie !== filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      const empNom = d.employes?.nom?.toLowerCase() || ''
      if (!d.titre.toLowerCase().includes(q) && !empNom.includes(q)) return false
    }
    return true
  })

  /* KPIs */
  const totalActifs    = documents.filter(d => d.statut === 'actif').length
  const totalArchives  = documents.filter(d => d.statut === 'archive').length
  const expiringCount  = documents.filter(d => isExpiringSoon(d.expiration)).length
  const expiredCount   = documents.filter(d => isExpired(d.expiration)).length

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#94A3B8]">
        <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mr-2" />
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <FolderOpen size={22} className="text-[#F59E0B]" />
            {t('rh.documents.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">{t('rh.documents.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12px] font-bold rounded-lg shadow-sm"
        >
          <Plus size={14} />
          {t('rh.documents.newDoc')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Documents actifs',   value: totalActifs.toString(),    color: '#F59E0B' },
          { label: 'Archivés',           value: totalArchives.toString(),  color: '#64748B' },
          { label: 'Expirent bientôt',   value: expiringCount.toString(),  color: '#D97706' },
          { label: 'Expirés',            value: expiredCount.toString(),   color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-center">
            <div className="text-[26px] font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {expiringCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A]">
          <FileText size={14} className="text-[#D97706] shrink-0" />
          <p className="text-[12px] text-[#D97706] font-medium">
            {expiringCount} document{expiringCount > 1 ? 's expirent' : ' expire'} dans moins de 30 jours
          </p>
        </div>
      )}
      {expiredCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FEE2E2] border border-[#FECACA]">
          <FileText size={14} className="text-[#DC2626] shrink-0" />
          <p className="text-[12px] text-[#DC2626] font-medium">
            {expiredCount} document{expiredCount > 1 ? 's sont expirés' : ' est expiré'} — à renouveler
          </p>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[#0F172A] text-[15px]">Ajouter un document RH</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">

              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Employé</label>
                <select
                  value={form.employe_id}
                  onChange={e => setForm(f => ({ ...f, employe_id: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                >
                  <option value="">— Document général / entreprise —</option>
                  {employes.map(e => (
                    <option key={e.id} value={e.id}>{e.nom} — {e.poste}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Catégorie *</label>
                  <select
                    value={form.categorie}
                    onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Titre *</label>
                  <input
                    value={form.titre}
                    onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                    placeholder="ex: Contrat CDI signé"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">URL du fichier</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://… (lien Supabase Storage, Drive, etc.)"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Extension</label>
                  <input
                    value={form.extension}
                    onChange={e => setForm(f => ({ ...f, extension: e.target.value }))}
                    placeholder="pdf"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date document</label>
                  <input type="date" value={form.date_document}
                    onChange={e => setForm(f => ({ ...f, date_document: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Expiration</label>
                  <input type="date" value={form.expiration}
                    onChange={e => setForm(f => ({ ...f, expiration: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 resize-none"
                  placeholder="Remarques…"
                />
              </div>

              {error && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {t('common.save')}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-[12px] text-[#64748B] hover:bg-[#F8FAFC]">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('rh.documents.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 bg-white"
          />
        </div>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg border transition-colors ${
            showArchived ? 'bg-[#64748B] text-white border-[#64748B]' : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F8FAFC]'
          }`}
        >
          <Archive size={12} />
          {showArchived ? 'Masquer archivés' : 'Voir archivés'}
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl border border-[#E2E8F0] p-1">
        <button
          onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filterCat === 'all' ? 'bg-[#F59E0B] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
        >
          Tous ({documents.filter(d => showArchived || d.statut !== 'archive').length})
        </button>
        {CATEGORIES.map(cat => {
          const cnt = documents.filter(d => d.categorie === cat.value && (showArchived || d.statut !== 'archive')).length
          if (cnt === 0) return null

          /* Translate tabs for contrat / attestation / autre */
          const catLabel =
            cat.value === 'contrat'     ? t('rh.documents.tab.contrats')     :
            cat.value === 'attestation' ? t('rh.documents.tab.attestations') :
            cat.value === 'autre'       ? t('rh.documents.tab.autres')       :
            cat.label

          return (
            <button
              key={cat.value}
              onClick={() => setFilterCat(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
                filterCat === cat.value ? 'text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
              style={filterCat === cat.value ? { background: cat.color } : {}}
            >
              {cat.icon} {catLabel} ({cnt})
            </button>
          )
        })}
      </div>

      {/* Document list */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-20 text-center">
          <FolderOpen size={36} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[14px] font-semibold text-[#64748B]">{t('rh.documents.noDocuments')}</p>
          <p className="text-[12px] text-[#94A3B8] mt-1">Ajoutez des documents pour les retrouver ici</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(doc => {
            const cat     = CATEGORIES.find(c => c.value === doc.categorie)
            const extInfo = EXT_ICONS[doc.extension?.toLowerCase() ?? ''] || { icon: '📄', color: '#64748B' }
            const expiring = isExpiringSoon(doc.expiration)
            const expired  = isExpired(doc.expiration)
            const archived = doc.statut === 'archive'

            return (
              <div
                key={doc.id}
                className={`bg-white rounded-xl border overflow-hidden hover:shadow-sm transition-all ${
                  expired ? 'border-[#FECACA]' : expiring ? 'border-[#FDE68A]' : archived ? 'border-dashed border-[#E2E8F0] opacity-60' : 'border-[#E2E8F0]'
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                       style={{ background: (cat?.color || '#64748B') + '15' }}>
                    {extInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-[#0F172A] truncate">{doc.titre}</span>
                      {cat && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: cat.color + '18', color: cat.color }}>
                          {cat.icon} {cat.label}
                        </span>
                      )}
                      {expired && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#DC2626] font-bold">EXPIRÉ</span>}
                      {expiring && !expired && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#D97706] font-bold">EXPIRE BIENTÔT</span>}
                      {archived && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#94A3B8] font-bold">ARCHIVÉ</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-[#64748B]">
                        {doc.employes ? doc.employes.nom : 'Document général'}
                      </span>
                      {doc.date_document && (
                        <span className="text-[10px] text-[#94A3B8]">{fmtDate(doc.date_document, intlLocale)}</span>
                      )}
                      {doc.expiration && (
                        <span className="text-[10px] text-[#94A3B8]">expire: {fmtDate(doc.expiration, intlLocale)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {doc.url && (
                      <>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center hover:bg-[#DBEAFE]"
                          title="Voir"
                        >
                          <Eye size={12} className="text-[#2563EB]" />
                        </a>
                        <a
                          href={doc.url}
                          download
                          className="w-7 h-7 rounded-lg bg-[#F0FDF4] flex items-center justify-center hover:bg-[#DCFCE7]"
                          title={t('common.download')}
                        >
                          <Download size={12} className="text-[#16A34A]" />
                        </a>
                      </>
                    )}
                    <button
                      onClick={() => handleArchive(doc.id, doc.statut)}
                      className="w-7 h-7 rounded-lg bg-[#F1F5F9] flex items-center justify-center hover:bg-[#E2E8F0]"
                      title={archived ? 'Restaurer' : 'Archiver'}
                    >
                      {archived ? <RefreshCw size={11} className="text-[#64748B]" /> : <Archive size={11} className="text-[#64748B]" />}
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="w-7 h-7 rounded-lg bg-[#FEE2E2] flex items-center justify-center hover:bg-[#FECACA]"
                      title={t('common.delete')}
                    >
                      <Trash2 size={11} className="text-[#DC2626]" />
                    </button>
                  </div>
                </div>
                {doc.notes && (
                  <div className="border-t border-[#F8FAFC] px-3 py-1.5 text-[11px] text-[#94A3B8] italic">{doc.notes}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
