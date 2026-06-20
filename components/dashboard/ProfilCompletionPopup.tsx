'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, Upload, Building2, User, FileText, Globe,
  Check, Save, ChevronDown, ChevronUp, Camera, Loader2,
} from 'lucide-react'
import { saveProfilCompletion, fetchProfilCompletion, type ProfilCompletionData } from '@/app/dashboard/profil/actions'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean
  onClose: () => void
}

type SectionId = 'entreprise' | 'fiscal' | 'dirigeant' | 'documents' | 'footer'

// ── Shared input style ─────────────────────────────────────────────────────────

const INPUT = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15 bg-white'

// ── Completion percentage (matches server logic) ───────────────────────────────

const PCT_FIELDS = [
  'nom_entreprise', 'secteur_activite', 'pays',
  'logo_url', 'adresse', 'ville', 'telephone',
  'email_contact', 'site_web', 'niu', 'rccm',
  'numero_fiscal', 'mobile_money',
  'dirigeant_nom', 'dirigeant_fonction', 'dirigeant_telephone',
  'dirigeant_email', 'dirigeant_photo_url',
  '_reseaux', '_documents',
] as const

function computeLocalPct(form: Record<string, unknown>): number {
  let score = 0
  const per = 100 / PCT_FIELDS.length
  for (const f of PCT_FIELDS) {
    if (f === '_reseaux') {
      const rs = form.reseaux_sociaux as Record<string, string> | null
      if (rs && Object.values(rs).some(v => v && String(v).trim())) score += per
    } else if (f === '_documents') {
      const dl = form.documents_legaux as unknown[] | null
      if (dl && dl.length > 0) score += per
    } else {
      const v = form[f]
      if (v !== null && v !== undefined && String(v).trim() !== '') score += per
    }
  }
  return Math.round(Math.min(score, 100))
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProfilCompletionPopup({ open, onClose }: Props) {
  const { reload, tenant } = useTenantContext()

  const [form, setForm] = useState<ProfilCompletionData & {
    nom_entreprise?: string; secteur_activite?: string; pays?: string
  }>({})
  const [pct,           setPct]           = useState(0)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [loadErr,       setLoadErr]       = useState('')
  const [openSec,       setOpenSec]       = useState<SectionId>('entreprise')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoPreview,   setLogoPreview]   = useState<string | null>(null)
  const logoFileRef = useRef<HTMLInputElement>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load current data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    fetchProfilCompletion().then(({ data, error }) => {
      if (error || !data) { setLoadErr(error ?? 'Erreur de chargement'); return }
      const { pct: p, ...rest } = data
      setForm(rest)
      setPct(p)
    })
  }, [open])

  // ── Field change + autosave ────────────────────────────────────────────────

  function upd(key: string, value: unknown) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      setPct(computeLocalPct(next as Record<string, unknown>))
      return next
    })
    setSaved(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => autoSave({ [key]: value }), 1500)
  }

  function updSocial(key: string, value: string) {
    setForm(prev => {
      const next = { ...prev, reseaux_sociaux: { ...(prev.reseaux_sociaux ?? {}), [key]: value } }
      setPct(computeLocalPct(next as Record<string, unknown>))
      return next
    })
    setSaved(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setForm(prev => { autoSave({ reseaux_sociaux: prev.reseaux_sociaux }); return prev })
    }, 1500)
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Logo trop lourd. Maximum 2 MB.'); return }
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      alert('Format accepté : PNG, JPG, SVG, WebP'); return
    }
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setLogoUploading(true)
    try {
      const tenantId = tenant?.tenantId ?? 'unknown'
      const ext  = file.name.split('.').pop() ?? 'png'
      const path = `logos/${tenantId}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      upd('logo_url', publicUrl)
      setLogoPreview(null)
    } catch {
      alert('Erreur upload. Vérifiez que le bucket "logos" est public dans Supabase Storage.')
      setLogoPreview(null)
    } finally {
      setLogoUploading(false)
      if (logoFileRef.current) logoFileRef.current.value = ''
    }
  }

  const autoSave = useCallback(async (partial: ProfilCompletionData) => {
    setSaving(true)
    await saveProfilCompletion(partial)
    setSaving(false)
    setSaved(true)
    reload()
  }, [reload])

  async function handleSaveAll() {
    setSaving(true)
    const { pct: serverPct } = (await saveProfilCompletion(form as ProfilCompletionData)) as { pct?: number }
    setSaving(false)
    setSaved(true)
    if (serverPct !== undefined) setPct(serverPct)
    reload()
  }

  // ── Section toggle ─────────────────────────────────────────────────────────

  function toggleSection(id: SectionId) {
    setOpenSec(prev => prev === id ? 'entreprise' : id)
  }

  if (!open) return null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-xl max-h-[92vh] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h2 className="text-[16px] font-black text-[#0F172A]">Finaliser mon entreprise</h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              Les informations complètes apparaissent sur vos documents officiels.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F1F5F9] transition-all">
            <X size={16} className="text-[#64748B]" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-bold text-[#64748B]">Profil complété</span>
            <span className="text-[13px] font-black" style={{ color: pct >= 80 ? '#16A34A' : pct >= 50 ? '#F59E0B' : '#DC2626' }}>
              {pct}%
            </span>
          </div>
          <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct >= 80 ? '#16A34A' : pct >= 50 ? '#F59E0B' : '#DC2626',
              }} />
          </div>
          {pct >= 100 && (
            <p className="text-[11px] text-[#16A34A] font-bold mt-1 flex items-center gap-1">
              <Check size={11} /> Profil 100% complété
            </p>
          )}
        </div>

        {loadErr && (
          <div className="px-6 py-3 bg-[#FEF2F2] text-[#DC2626] text-[13px]">{loadErr}</div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── SECTION: Informations entreprise ──────────────────────────── */}
          <Section id="entreprise" label="Informations entreprise" icon={<Building2 size={14} />}
            open={openSec === 'entreprise'} onToggle={() => toggleSection('entreprise')}>
            <div className="space-y-3">

              {/* Logo — upload direct */}
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Logo</label>
                <div className="flex items-center gap-4">
                  {/* Zone cliquable logo */}
                  <button
                    type="button"
                    onClick={() => logoFileRef.current?.click()}
                    className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center overflow-hidden shrink-0 hover:border-[#F59E0B] transition-colors group"
                  >
                    {logoUploading ? (
                      <Loader2 size={20} className="text-[#F59E0B] animate-spin" />
                    ) : (logoPreview || form.logo_url) ? (
                       
                      <img src={logoPreview ?? form.logo_url ?? ''} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-[10px] font-bold text-[#CBD5E1]">LOGO</span>
                    )}
                    {/* Overlay caméra au hover */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                      <Camera size={18} className="text-white" />
                    </div>
                  </button>
                  {/* Instructions */}
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => logoFileRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[12px] font-semibold text-[#0F172A] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-all w-full justify-center"
                    >
                      <Camera size={13} />
                      {form.logo_url ? 'Changer le logo' : 'Télécharger un logo'}
                    </button>
                    <p className="text-[10px] text-[#94A3B8] mt-1.5 text-center">PNG, JPG, SVG, WebP — Max 2 MB</p>
                    {form.logo_url && !logoPreview && (
                      <button
                        type="button"
                        onClick={() => upd('logo_url', '')}
                        className="text-[10px] text-[#DC2626] hover:underline mt-1 w-full text-center block"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoFile}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Adresse</label>
                  <input type="text" placeholder="Rue, avenue..." value={form.adresse ?? ''}
                    onChange={e => upd('adresse', e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Ville</label>
                  <input type="text" placeholder="Brazzaville..." value={form.ville ?? ''}
                    onChange={e => upd('ville', e.target.value)} className={INPUT} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Téléphone</label>
                  <input type="tel" placeholder="+242 06..." value={form.telephone ?? ''}
                    onChange={e => upd('telephone', e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Email contact</label>
                  <input type="email" placeholder="contact@..." value={form.email_contact ?? ''}
                    onChange={e => upd('email_contact', e.target.value)} className={INPUT} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Site web</label>
                <input type="url" placeholder="https://..." value={form.site_web ?? ''}
                  onChange={e => upd('site_web', e.target.value)} className={INPUT} />
              </div>
            </div>
          </Section>

          {/* ── SECTION: Identifiants fiscaux ─────────────────────────────── */}
          <Section id="fiscal" label="Identifiants fiscaux" icon={<FileText size={14} />}
            open={openSec === 'fiscal'} onToggle={() => toggleSection('fiscal')}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">NIU</label>
                  <input type="text" placeholder="Numéro d'Identification Unique" value={form.niu ?? ''}
                    onChange={e => upd('niu', e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">RCCM</label>
                  <input type="text" placeholder="Registre de commerce" value={form.rccm ?? ''}
                    onChange={e => upd('rccm', e.target.value)} className={INPUT} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Numéro fiscal</label>
                  <input type="text" placeholder="NIF/Fiscal" value={form.numero_fiscal ?? ''}
                    onChange={e => upd('numero_fiscal', e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Mobile Money</label>
                  <input type="text" placeholder="MTN / Airtel / Orange" value={form.mobile_money ?? ''}
                    onChange={e => upd('mobile_money', e.target.value)} className={INPUT} />
                </div>
              </div>
            </div>
          </Section>

          {/* ── SECTION: Dirigeant ────────────────────────────────────────── */}
          <Section id="dirigeant" label="Dirigeant" icon={<User size={14} />}
            open={openSec === 'dirigeant'} onToggle={() => toggleSection('dirigeant')}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Nom complet</label>
                  <input type="text" placeholder="Jean Dupont" value={form.dirigeant_nom ?? ''}
                    onChange={e => upd('dirigeant_nom', e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Fonction</label>
                  <input type="text" placeholder="Directeur Général" value={form.dirigeant_fonction ?? ''}
                    onChange={e => upd('dirigeant_fonction', e.target.value)} className={INPUT} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Téléphone</label>
                  <input type="tel" placeholder="+242..." value={form.dirigeant_telephone ?? ''}
                    onChange={e => upd('dirigeant_telephone', e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Email</label>
                  <input type="email" placeholder="dirigeant@..." value={form.dirigeant_email ?? ''}
                    onChange={e => upd('dirigeant_email', e.target.value)} className={INPUT} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Photo (URL)</label>
                <input type="url" placeholder="https://... (upload S3 prochainement)" value={form.dirigeant_photo_url ?? ''}
                  onChange={e => upd('dirigeant_photo_url', e.target.value)} className={INPUT} />
              </div>
            </div>
          </Section>

          {/* ── SECTION: Documents ────────────────────────────────────────── */}
          <Section id="documents" label="Pièces & Documents" icon={<Upload size={14} />}
            open={openSec === 'documents'} onToggle={() => toggleSection('documents')}>
            <div className="space-y-3">
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-center">
                <Upload size={22} className="mx-auto mb-2 text-[#94A3B8]" />
                <p className="text-[13px] font-bold text-[#374151] mb-1">Stockage S3 à venir</p>
                <p className="text-[12px] text-[#94A3B8]">
                  Les pièces justificatives (documents légaux, fiscaux, pièce d&apos;identité du dirigeant)
                  pourront être téléversées ici prochainement.
                </p>
              </div>
              {/* List existing documents */}
              {(form.documents_legaux ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(form.documents_legaux ?? []).map((doc, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-[12px]">
                      <span className="text-[#374151] font-medium truncate">{doc.nom}</span>
                      <span className="text-[#94A3B8] shrink-0 ml-2">{doc.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          {/* ── SECTION: Réseaux sociaux / Bas de page ───────────────────── */}
          <Section id="footer" label="Bas de page & Réseaux" icon={<Globe size={14} />}
            open={openSec === 'footer'} onToggle={() => toggleSection('footer')}>
            <div className="space-y-3">
              {[
                { key: 'facebook',  label: 'Facebook',  ph: 'https://facebook.com/...' },
                { key: 'linkedin',  label: 'LinkedIn',  ph: 'https://linkedin.com/...' },
                { key: 'instagram', label: 'Instagram', ph: 'https://instagram.com/...' },
                { key: 'twitter',   label: 'X / Twitter', ph: 'https://x.com/...' },
                { key: 'tiktok',    label: 'TikTok',    ph: 'https://tiktok.com/...' },
              ].map(({ key, label, ph }) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">{label}</label>
                  <input type="url" placeholder={ph}
                    value={(form.reseaux_sociaux as Record<string, string> | undefined)?.[key] ?? ''}
                    onChange={e => updSocial(key, e.target.value)}
                    className={INPUT} />
                </div>
              ))}
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-white shrink-0 flex items-center justify-between gap-3">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl border-2 border-[#E2E8F0] text-[13px] font-bold text-[#64748B] hover:bg-[#F8FAFC] transition-all">
            Terminer plus tard
          </button>

          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-[12px] text-[#94A3B8] flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-[#94A3B8]/30 border-t-[#F59E0B] rounded-full animate-spin" />
                Sauvegarde...
              </span>
            )}
            {saved && !saving && (
              <span className="text-[12px] text-[#16A34A] flex items-center gap-1">
                <Check size={12} /> Sauvegardé
              </span>
            )}
            <button onClick={handleSaveAll} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-black text-white bg-[#F59E0B] hover:bg-[#D97706] transition-all disabled:opacity-60">
              <Save size={14} /> Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section accordion ──────────────────────────────────────────────────────────

function Section({
  id: _id, label, icon, open, onToggle, children,
}: {
  id:       SectionId
  label:    string
  icon:     React.ReactNode
  open:     boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-[#E2E8F0] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F8FAFC] transition-all text-left">
        <div className="flex items-center gap-2.5">
          <span className="text-[#F59E0B]">{icon}</span>
          <span className="text-[13px] font-bold text-[#374151]">{label}</span>
        </div>
        {open ? <ChevronUp size={15} className="text-[#94A3B8]" /> : <ChevronDown size={15} className="text-[#94A3B8]" />}
      </button>
      {open && (
        <div className="px-6 pb-5 space-y-0">
          {children}
        </div>
      )}
    </div>
  )
}
