'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import {
  FolderOpen, Folder, Upload, Search, File, FileText,
  Image, ArchiveX, Download, Trash2, Plus, Eye, Star,
  PenSquare, LayoutGrid, List, X, Lock, Clock, Loader2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Doc {
  id: string
  nom: string
  description?: string
  type: string
  categorie: string
  url?: string
  taille_ko?: number
  statut: 'actif' | 'archive' | 'supprime'
  est_favori: boolean
  confidentiel: boolean
  date_document?: string
  date_expiration?: string
  tags: string[]
  source_module?: string
  dossier_id?: string
  created_at: string
}

interface Dossier {
  id: string
  nom: string
  couleur: string
  parent_id?: string
  ordre: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtSize(ko?: number) {
  if (!ko) return ''
  if (ko < 1024) return `${ko} Ko`
  return `${(ko / 1024).toFixed(1)} Mo`
}

const EXT_ICONS: Record<string, React.ReactNode> = {
  pdf:  <FileText size={20} className="text-red-500" />,
  doc:  <FileText size={20} className="text-blue-600" />,
  docx: <FileText size={20} className="text-blue-600" />,
  xls:  <FileText size={20} className="text-green-600" />,
  xlsx: <FileText size={20} className="text-green-600" />,
  png:  <Image size={20} className="text-purple-500" />,
  jpg:  <Image size={20} className="text-purple-500" />,
  jpeg: <Image size={20} className="text-purple-500" />,
}

const CATEGORIES = [
  { v: 'contrat',     key: 'ged.cat.contrats'    },
  { v: 'facture',     key: 'ged.cat.factures'    },
  { v: 'rh',          key: 'ged.cat.rh'          },
  { v: 'comptabilite',key: 'ged.cat.compta'      },
  { v: 'juridique',   key: 'ged.cat.juridique'   },
  { v: 'commercial',  key: 'ged.cat.commercial'  },
  { v: 'technique',   key: 'ged.cat.technique'   },
  { v: 'bulletin',    key: 'ged.cat.bulletin'    },
  { v: 'diplome',     key: 'ged.cat.diplome'     },
  { v: 'attestation', key: 'ged.cat.attestation' },
  { v: 'autre',       key: 'ged.cat.autre'       },
]

// ── SignatureModal ─────────────────────────────────────────────────────────────

interface SigProps {
  doc: Doc
  tenantId: string
  onClose: () => void
  onSigned: () => void
}

function SignatureModal({ doc, tenantId, onClose, onSigned }: SigProps) {
  const { t } = useLocale()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)
  const [name,    setName]    = useState('')
  const [role,    setRole]    = useState('')
  const [isEmpty, setIsEmpty] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#0F172A'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'

    function getPos(e: { clientX: number; clientY: number }) {
      const rect = canvas!.getBoundingClientRect()
      return {
        x: (e.clientX - rect.left) * (canvas!.width  / rect.width),
        y: (e.clientY - rect.top)  * (canvas!.height / rect.height),
      }
    }

    const onDown = (e: MouseEvent) => {
      drawing.current = true
      const p = getPos(e)
      ctx.beginPath(); ctx.moveTo(p.x, p.y)
    }
    const onMove = (e: MouseEvent) => {
      if (!drawing.current) return
      const p = getPos(e)
      ctx.lineTo(p.x, p.y); ctx.stroke()
      setIsEmpty(false)
    }
    const onUp = () => { drawing.current = false }

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      drawing.current = true
      const p = getPos(e.touches[0])
      ctx.beginPath(); ctx.moveTo(p.x, p.y)
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!drawing.current) return
      const p = getPos(e.touches[0])
      ctx.lineTo(p.x, p.y); ctx.stroke()
      setIsEmpty(false)
    }
    const onTouchEnd = () => { drawing.current = false }

    canvas.addEventListener('mousedown',  onDown)
    canvas.addEventListener('mousemove',  onMove)
    canvas.addEventListener('mouseup',    onUp)
    canvas.addEventListener('mouseleave', onUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false })
    canvas.addEventListener('touchend',   onTouchEnd)
    return () => {
      canvas.removeEventListener('mousedown',  onDown)
      canvas.removeEventListener('mousemove',  onMove)
      canvas.removeEventListener('mouseup',    onUp)
      canvas.removeEventListener('mouseleave', onUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove',  onTouchMove)
      canvas.removeEventListener('touchend',   onTouchEnd)
    }
  }, [])

  function clearCanvas() {
    const c = canvasRef.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setIsEmpty(true)
  }

  async function handleSign() {
    if (!name.trim() || isEmpty) return
    setSaving(true)
    const sigData = canvasRef.current!.toDataURL('image/png')
    await supabase.from('document_signatures').insert({
      tenant_id:       tenantId,
      document_id:     doc.id,
      signataire_nom:  name.trim(),
      signataire_role: role.trim() || null,
      signature_data:  sigData,
      signature_type:  'manuscrite',
      statut:          'signe',
      date_signature:  new Date().toISOString(),
    })
    setSaving(false)
    onSigned()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
          <h2 className="text-[15px] font-bold text-[#0F172A] flex items-center gap-2">
            <PenSquare size={16} className="text-[#DC2626]" />
            {t('ged.sig.title')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-[#64748B] truncate">{doc.nom}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.sig.name')}</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.sig.role')}</label>
              <input value={role} onChange={e => setRole(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.sig.draw')}</label>
              <button onClick={clearCanvas} className="text-[11px] text-[#DC2626] hover:underline">{t('ged.sig.clear')}</button>
            </div>
            <canvas
              ref={canvasRef}
              width={480}
              height={160}
              className="w-full rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#FAFAFA] cursor-crosshair touch-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
              {t('ged.sig.cancel')}
            </button>
            <button onClick={handleSign} disabled={saving || !name.trim() || isEmpty}
              className="flex-1 py-2.5 bg-[#DC2626] text-white rounded-xl text-[13px] font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 size={14} className="animate-spin" />{t('ged.sig.signing')}</>
                : t('ged.sig.sign')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AddDocModal ───────────────────────────────────────────────────────────────

interface AddDocProps {
  tenantId: string
  dossiers: Dossier[]
  onClose: () => void
  onAdded: () => void
}

function AddDocModal({ tenantId, dossiers, onClose, onAdded }: AddDocProps) {
  const { t } = useLocale()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nom: '', description: '', url: '', categorie: 'contrat', type: 'pdf',
    dossier_id: '', tags: '', confidentiel: false,
    date_document: '', date_expiration: '', source_module: '',
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim()) return
    setSaving(true)
    const tagsArr = form.tags.split(',').map(tg => tg.trim()).filter(Boolean)
    await supabase.from('documents').insert({
      tenant_id:       tenantId,
      nom:             form.nom.trim(),
      description:     form.description.trim() || null,
      url:             form.url.trim() || null,
      categorie:       form.categorie,
      type:            form.type,
      dossier_id:      form.dossier_id || null,
      tags:            tagsArr,
      confidentiel:    form.confidentiel,
      date_document:   form.date_document || null,
      date_expiration: form.date_expiration || null,
      source_module:   form.source_module || null,
      statut:          'actif',
    })
    setSaving(false)
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="text-[15px] font-bold text-[#0F172A] flex items-center gap-2">
            <Upload size={16} className="text-[#F59E0B]" />
            {t('ged.modalTitle')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.nomLabel')}</label>
            <input required value={form.nom} onChange={e => set('nom', e.target.value)}
              placeholder="Contrat_2026.pdf"
              className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.descLabel')}</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.urlLabel')}</label>
            <input value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://…"
              className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.categorieLabel')}</label>
              <select value={form.categorie} onChange={e => set('categorie', e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none bg-white">
                {CATEGORIES.map(c => <option key={c.v} value={c.v}>{t(c.key)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.typeLabel')}</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none bg-white">
                {['pdf','doc','docx','xls','xlsx','png','jpg','jpeg','autre'].map(tp => (
                  <option key={tp}>{tp}</option>
                ))}
              </select>
            </div>
          </div>
          {dossiers.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.dossierLabel')}</label>
              <select value={form.dossier_id} onChange={e => set('dossier_id', e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none bg-white">
                <option value="">— Aucun —</option>
                {dossiers.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.dateDocLabel')}</label>
              <input type="date" value={form.date_document} onChange={e => set('date_document', e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('ged.dateExpLabel')}</label>
              <input type="date" value={form.date_expiration} onChange={e => set('date_expiration', e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">
              {t('ged.tagsLabel')} <span className="normal-case text-[#94A3B8]">(séparés par virgule)</span>
            </label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="contrat, 2026, client"
              className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.confidentiel} onChange={e => set('confidentiel', e.target.checked)}
              className="w-4 h-4 accent-[#DC2626]" />
            <span className="text-[12px] text-[#64748B] flex items-center gap-1">
              <Lock size={11} className="text-[#DC2626]" />
              {t('ged.confidentielLabel')}
            </span>
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
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
  )
}

// ── GEDPage ────────────────────────────────────────────────────────────────────

export default function GEDPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [docs,        setDocs]        = useState<Doc[]>([])
  const [dossiers,    setDossiers]    = useState<Dossier[]>([])
  const [sigCounts,   setSigCounts]   = useState<Record<string, number>>({})
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [cat,         setCat]         = useState('all')
  const [view,        setView]        = useState<'list' | 'grid'>('list')
  const [activeView,  setActiveView]  = useState<string>('all')
  const [showAdd,     setShowAdd]     = useState(false)
  const [signDoc,     setSignDoc]     = useState<Doc | null>(null)
  const [newFolder,   setNewFolder]   = useState('')
  const [addingFoldr, setAddingFoldr] = useState(false)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: docsData }, { data: dossData }, { data: sigData }] = await Promise.all([
      supabase.from('documents').select('*')
        .eq('tenant_id', tenantId).neq('statut', 'supprime')
        .order('created_at', { ascending: false }),
      supabase.from('document_dossiers').select('*')
        .eq('tenant_id', tenantId).order('ordre').order('nom'),
      supabase.from('document_signatures').select('document_id')
        .eq('tenant_id', tenantId).eq('statut', 'en_attente'),
    ])
    setDocs((docsData ?? []) as Doc[])
    setDossiers((dossData ?? []) as Dossier[])
    const counts: Record<string, number> = {}
    ;(sigData ?? []).forEach((s: { document_id: string }) => {
      counts[s.document_id] = (counts[s.document_id] ?? 0) + 1
    })
    setSigCounts(counts)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function toggleFavorite(doc: Doc) {
    await supabase.from('documents').update({ est_favori: !doc.est_favori }).eq('id', doc.id)
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, est_favori: !d.est_favori } : d))
  }

  async function archiveDoc(id: string) {
    await supabase.from('documents').update({ statut: 'archive' }).eq('id', id)
    load()
  }

  async function deleteDoc(id: string) {
    if (!confirm(t('ged.deleteConfirm'))) return
    await supabase.from('documents').update({ statut: 'supprime' }).eq('id', id)
    load()
  }

  async function createFolder() {
    if (!newFolder.trim() || !tenantId) return
    setAddingFoldr(true)
    await supabase.from('document_dossiers').insert({
      tenant_id: tenantId,
      nom: newFolder.trim(),
      ordre: dossiers.length,
    })
    setNewFolder('')
    setAddingFoldr(false)
    load()
  }

  const toSignTotal = Object.values(sigCounts).reduce((a, b) => a + b, 0)

  const isExpired = (d: Doc) =>
    !!d.date_expiration && new Date(d.date_expiration) < new Date()

  const isExpiringSoon = (d: Doc) => {
    if (!d.date_expiration) return false
    const diff = (new Date(d.date_expiration).getTime() - Date.now()) / 86400000
    return diff >= 0 && diff <= 30
  }

  const filtered = docs.filter(d => {
    if (activeView === 'favorites') return d.est_favori && d.statut === 'actif'
    if (activeView === 'toSign')    return (sigCounts[d.id] ?? 0) > 0 && d.statut === 'actif'
    if (activeView !== 'all')       return d.dossier_id === activeView && d.statut === 'actif'
    if (d.statut !== 'actif') return false
    if (cat !== 'all' && d.categorie !== cat) return false
    const q = search.toLowerCase()
    return !q || d.nom.toLowerCase().includes(q) || d.tags.some(tg => tg.toLowerCase().includes(q))
  })

  const docIcon = (doc: Doc) => {
    const ext = doc.nom.split('.').pop()?.toLowerCase() ?? doc.type
    return EXT_ICONS[ext] ?? <File size={20} className="text-[#94A3B8]" />
  }

  const docCount = (id: string) =>
    docs.filter(d => d.dossier_id === id && d.statut === 'actif').length

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 bg-white border border-[#E2E8F0] rounded-2xl p-3 flex flex-col gap-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide px-2 pt-1 mb-1">
          {t('ged.folder.title')}
        </p>

        {/* Virtual views */}
        {[
          { id: 'all',       label: t('ged.folder.all'),       badge: docs.filter(d => d.statut === 'actif').length, icon: <FolderOpen size={13} /> },
          { id: 'favorites', label: t('ged.folder.favorites'), badge: docs.filter(d => d.est_favori && d.statut === 'actif').length, icon: <Star size={13} className="text-amber-400" /> },
          { id: 'toSign',    label: t('ged.folder.toSign'),    badge: toSignTotal, icon: <PenSquare size={13} className="text-[#DC2626]" /> },
        ].map(item => (
          <button key={item.id} onClick={() => setActiveView(item.id)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12px] font-medium w-full text-left transition-colors ${
              activeView === item.id ? 'bg-[#F1F5F9] text-[#0F172A] font-semibold' : 'text-[#64748B] hover:bg-[#F8FAFC]'
            }`}>
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.badge > 0 && (
              <span className="text-[10px] bg-[#E2E8F0] text-[#64748B] rounded-full px-1.5 py-0.5 font-semibold">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {/* Custom folders */}
        {dossiers.length > 0 && <div className="my-1 border-t border-[#F1F5F9]" />}
        {dossiers.map(d => (
          <button key={d.id} onClick={() => setActiveView(d.id)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12px] font-medium w-full text-left transition-colors ${
              activeView === d.id ? 'bg-[#F1F5F9] text-[#0F172A] font-semibold' : 'text-[#64748B] hover:bg-[#F8FAFC]'
            }`}>
            <Folder size={13} style={{ color: d.couleur }} />
            <span className="flex-1 truncate">{d.nom}</span>
            <span className="text-[10px] bg-[#E2E8F0] text-[#64748B] rounded-full px-1.5 py-0.5">
              {docCount(d.id)}
            </span>
          </button>
        ))}

        {/* New folder */}
        <div className="mt-auto pt-2 border-t border-[#F1F5F9]">
          <div className="flex gap-1">
            <input
              value={newFolder}
              onChange={e => setNewFolder(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()}
              placeholder={t('ged.folder.newPlh')}
              className="flex-1 px-2 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300 min-w-0"
            />
            <button onClick={createFolder} disabled={addingFoldr || !newFolder.trim()}
              className="px-2 py-1.5 bg-[#F59E0B] text-white rounded-lg hover:bg-amber-600 disabled:opacity-40">
              <Plus size={12} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 gap-3">

        {/* Header bar */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl px-5 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center shrink-0">
            <FolderOpen size={18} className="text-[#F59E0B]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#0F172A]">{t('ged.title')}</h1>
            <p className="text-[11px] text-[#64748B]">{t('ged.subtitle')}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Grid / List toggle */}
            <div className="flex border border-[#E2E8F0] rounded-lg overflow-hidden">
              <button onClick={() => setView('list')}
                className={`p-1.5 transition-colors ${view === 'list' ? 'bg-[#F1F5F9]' : 'hover:bg-[#F8FAFC]'}`}>
                <List size={14} className="text-[#64748B]" />
              </button>
              <button onClick={() => setView('grid')}
                className={`p-1.5 transition-colors ${view === 'grid' ? 'bg-[#F1F5F9]' : 'hover:bg-[#F8FAFC]'}`}>
                <LayoutGrid size={14} className="text-[#64748B]" />
              </button>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F59E0B] text-white text-[12px] font-semibold hover:bg-amber-600 shadow-sm transition-colors">
              <Plus size={13} />
              {t('ged.addBtn')}
            </button>
          </div>
        </div>

        {/* Search + category chips (only on "all" view) */}
        {activeView === 'all' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input type="text" placeholder={t('ged.searchPlaceholder')} value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setCat('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${cat === 'all' ? 'bg-[#F59E0B] text-white' : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}>
                {t('ged.cat.all')}
              </button>
              {CATEGORIES.map(c => (
                <button key={c.v} onClick={() => setCat(c.v)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${cat === c.v ? 'bg-[#F59E0B] text-white' : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}>
                  {t(c.key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Document list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-[#94A3B8]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
              <FolderOpen size={48} className="text-[#E2E8F0]" />
              <p className="text-[13px] text-[#94A3B8]">{t('ged.noDocument')}</p>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-semibold hover:bg-amber-600">
                <Plus size={13} />{t('ged.addBtn')}
              </button>
            </div>
          ) : view === 'list' ? (
            /* ── List view ── */
            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
              <div className="divide-y divide-[#F8FAFC]">
                {filtered.map(doc => {
                  const expired      = isExpired(doc)
                  const expiringSoon = !expired && isExpiringSoon(doc)
                  const pendingSig   = sigCounts[doc.id] ?? 0
                  return (
                    <div key={doc.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition-colors group">
                      <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] flex items-center justify-center shrink-0">
                        {docIcon(doc)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[13px] font-semibold text-[#0F172A] truncate max-w-[280px]">
                            {doc.nom}
                          </p>
                          {doc.confidentiel && <Lock size={11} className="text-[#DC2626] shrink-0" />}
                          {expired && (
                            <span className="text-[10px] bg-red-50 text-red-600 font-semibold px-1.5 py-0.5 rounded-md">
                              {t('ged.doc.expired')}
                            </span>
                          )}
                          {expiringSoon && (
                            <span className="text-[10px] bg-amber-50 text-amber-600 font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <Clock size={9} />{t('ged.doc.expiringSoon')}
                            </span>
                          )}
                          {pendingSig > 0 && (
                            <span className="text-[10px] bg-purple-50 text-purple-600 font-semibold px-1.5 py-0.5 rounded-md">
                              {pendingSig} {t('ged.doc.signs')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-md font-medium">
                            {doc.categorie}
                          </span>
                          <span className="text-[10px] text-[#94A3B8]">{fmtDate(doc.created_at)}</span>
                          {doc.taille_ko && <span className="text-[10px] text-[#94A3B8]">{fmtSize(doc.taille_ko)}</span>}
                          {doc.tags.slice(0, 3).map(tg => (
                            <span key={tg} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">
                              #{tg}
                            </span>
                          ))}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {doc.url && (
                          <>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-[#64748B] hover:text-blue-600 transition-colors">
                              <Eye size={13} />
                            </a>
                            <a href={doc.url} download
                              className="p-1.5 rounded-lg hover:bg-green-50 text-[#64748B] hover:text-green-600 transition-colors">
                              <Download size={13} />
                            </a>
                          </>
                        )}
                        <button onClick={() => toggleFavorite(doc)}
                          title={doc.est_favori ? t('ged.favoriteOff') : t('ged.favoriteOn')}
                          className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                          <Star size={13} className={doc.est_favori ? 'text-amber-400 fill-amber-400' : 'text-[#94A3B8]'} />
                        </button>
                        <button onClick={() => setSignDoc(doc)}
                          className="p-1.5 rounded-lg hover:bg-purple-50 text-[#64748B] hover:text-purple-600 transition-colors">
                          <PenSquare size={13} />
                        </button>
                        <button onClick={() => archiveDoc(doc.id)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-[#64748B] hover:text-amber-600 transition-colors">
                          <ArchiveX size={13} />
                        </button>
                        <button onClick={() => deleteDoc(doc.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* ── Grid view ── */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(doc => {
                const expired      = isExpired(doc)
                const expiringSoon = !expired && isExpiringSoon(doc)
                return (
                  <div key={doc.id}
                    className="bg-white border border-[#E2E8F0] rounded-2xl p-4 flex flex-col gap-2 hover:border-[#F59E0B]/50 transition-colors group relative">
                    {doc.confidentiel && (
                      <Lock size={11} className="absolute top-3 right-3 text-[#DC2626]" />
                    )}
                    <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] flex items-center justify-center">
                      {docIcon(doc)}
                    </div>
                    <p className="text-[12px] font-semibold text-[#0F172A] truncate">{doc.nom}</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-md">
                        {doc.categorie}
                      </span>
                      {expired && (
                        <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md">
                          {t('ged.doc.expired')}
                        </span>
                      )}
                      {expiringSoon && (
                        <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md">
                          {t('ged.doc.expiringSoon')}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#94A3B8]">{fmtDate(doc.created_at)}</p>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="p-1 rounded-lg hover:bg-blue-50 text-[#94A3B8] hover:text-blue-600">
                          <Eye size={12} />
                        </a>
                      )}
                      <button onClick={() => toggleFavorite(doc)} className="p-1 rounded-lg hover:bg-amber-50">
                        <Star size={12} className={doc.est_favori ? 'text-amber-400 fill-amber-400' : 'text-[#94A3B8]'} />
                      </button>
                      <button onClick={() => setSignDoc(doc)}
                        className="p-1 rounded-lg hover:bg-purple-50 text-[#94A3B8] hover:text-purple-600">
                        <PenSquare size={12} />
                      </button>
                      <button onClick={() => deleteDoc(doc.id)}
                        className="p-1 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 ml-auto">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {showAdd && tenantId && (
        <AddDocModal
          tenantId={tenantId}
          dossiers={dossiers}
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}

      {signDoc && tenantId && (
        <SignatureModal
          doc={signDoc}
          tenantId={tenantId}
          onClose={() => setSignDoc(null)}
          onSigned={load}
        />
      )}
    </div>
  )
}
