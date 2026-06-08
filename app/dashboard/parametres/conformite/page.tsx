'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  Shield, Upload, CheckCircle2, AlertCircle, Building2,
  FileText, Users, Camera, Save, Info,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConformiteData {
  logo_url:          string
  photo_dirigeant:   string
  nom_dirigeant:     string
  niu:               string
  rccm:              string
  adresse_siege:     string
  adresse_fiscale:   string
  capital_social:    string
  forme_juridique:   string
  date_creation:     string
  actionnaires:      string
  documents_statuts: string
  documents_fiscaux: string
}

const FORMES = ['SARL', 'SA', 'SAS', 'SNC', 'GIE', 'EI', 'EURL', 'Association', 'ONG', 'Autre']

// ── Field section component ───────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-[#F1F5F9]">
        <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
          <Icon size={15} className="text-[#F59E0B]" />
        </div>
        <h2 className="text-[13px] font-bold text-[#0F172A]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, name, value, onChange, type = 'text', placeholder = '' }: {
  label: string; name: string; value: string
  onChange: (k: string, v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(name, e.target.value)}
        className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition-all"
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConformitePage() {
  const { tenant } = useTenantContext()
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [data, setData] = useState<ConformiteData>({
    logo_url: '', photo_dirigeant: '', nom_dirigeant: '',
    niu: '', rccm: '', adresse_siege: '', adresse_fiscale: '',
    capital_social: '', forme_juridique: '', date_creation: '',
    actionnaires: '', documents_statuts: '', documents_fiscaux: '',
  })

  function upd(k: string, v: string) {
    setData(p => ({ ...p, [k]: v }))
    setSaved(false)
  }

  async function handleSave() {
    if (!tenant?.tenantId) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('entreprise_config')
      .upsert({
        tenant_id:          tenant.tenantId,
        logo_url:           data.logo_url || null,
        photo_dirigeant:    data.photo_dirigeant || null,
        nom_dirigeant:      data.nom_dirigeant || null,
        niu:                data.niu || null,
        rccm:               data.rccm || null,
        adresse_siege:      data.adresse_siege || null,
        adresse_fiscale:    data.adresse_fiscale || null,
        capital_social:     data.capital_social || null,
        forme_juridique:    data.forme_juridique || null,
        date_creation:      data.date_creation || null,
        actionnaires:       data.actionnaires || null,
        documents_statuts:  data.documents_statuts || null,
        documents_fiscaux:  data.documents_fiscaux || null,
      }, { onConflict: 'tenant_id' })

    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tenant?.tenantId) return
    const ext  = file.name.split('.').pop()
    const path = `logos/${tenant.tenantId}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('entreprise')
      .upload(path, file, { upsert: true })
    if (upErr) { setError(upErr.message); return }
    const { data: { publicUrl } } = supabase.storage.from('entreprise').getPublicUrl(path)
    upd('logo_url', publicUrl)
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Shield size={20} className="text-[#F59E0B]" />
          <h1 className="text-[20px] font-extrabold text-[#0F172A]">Centre de Conformité</h1>
        </div>
        <p className="text-[13px] text-[#64748B]">
          Paramètres › Conformité entreprise
        </p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl"
        style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-[12px] text-blue-800 leading-relaxed">
          Vos documents sont stockés de manière sécurisée et utilisés uniquement pour la gestion de votre entreprise.
          Ils ne sont jamais partagés avec des tiers.
        </p>
      </div>

      {/* ── Identité visuelle ─────────────────────────────────────────────── */}
      <Section title="Identité visuelle" icon={Camera}>
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Logo */}
          <div>
            <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Logo de l&apos;entreprise</p>
            <div
              className="w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:border-[#F59E0B] hover:bg-[#FFFBEB]"
              style={{ borderColor: data.logo_url ? '#16A34A' : '#E2E8F0' }}
              onClick={() => fileRef.current?.click()}
            >
              {data.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.logo_url} alt="Logo" className="max-h-20 max-w-full object-contain" />
              ) : (
                <>
                  <Upload size={20} className="text-[#94A3B8] mb-1" />
                  <span className="text-[11px] text-[#94A3B8]">PNG, JPG, SVG — max 2 MB</span>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            {data.logo_url && (
              <input type="text" value={data.logo_url} onChange={e => upd('logo_url', e.target.value)}
                placeholder="URL du logo" className="mt-2 w-full px-3 py-2 text-[11px] border border-[#E2E8F0] rounded-lg text-[#64748B] outline-none" />
            )}
          </div>

          {/* Photo dirigeant */}
          <div>
            <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Photo du dirigeant</p>
            <div className="w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center"
              style={{ borderColor: '#E2E8F0' }}>
              {data.photo_dirigeant ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.photo_dirigeant} alt="Dirigeant" className="max-h-20 max-w-full object-contain rounded-lg" />
              ) : (
                <>
                  <Camera size={20} className="text-[#94A3B8] mb-1" />
                  <span className="text-[11px] text-[#94A3B8]">Entrez l&apos;URL de la photo</span>
                </>
              )}
            </div>
            <input type="url" value={data.photo_dirigeant} onChange={e => upd('photo_dirigeant', e.target.value)}
              placeholder="https://..." className="mt-2 w-full px-3 py-2 text-[11px] border border-[#E2E8F0] rounded-lg text-[#64748B] outline-none focus:border-[#F59E0B]" />
          </div>
        </div>
      </Section>

      {/* ── Informations légales ──────────────────────────────────────────── */}
      <Section title="Informations légales" icon={Building2}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="NIU (Numéro d'Identification Unique)" name="niu" value={data.niu}
            onChange={upd} placeholder="M20123456789A" />
          <Field label="RCCM" name="rccm" value={data.rccm}
            onChange={upd} placeholder="CG-BZV-01-2023-B12-00123" />
          <div>
            <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
              Forme juridique
            </label>
            <select value={data.forme_juridique} onChange={e => upd('forme_juridique', e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] outline-none focus:border-[#F59E0B] bg-white">
              <option value="">Sélectionner...</option>
              {FORMES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <Field label="Capital social (FCFA)" name="capital_social" value={data.capital_social}
            onChange={upd} placeholder="1 000 000" />
          <Field label="Date de création" name="date_creation" value={data.date_creation}
            onChange={upd} type="date" />
          <Field label="Nom du dirigeant" name="nom_dirigeant" value={data.nom_dirigeant}
            onChange={upd} placeholder="Prénom Nom" />
        </div>
      </Section>

      {/* ── Adresses ─────────────────────────────────────────────────────── */}
      <Section title="Adresses" icon={Building2}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Adresse du siège social" name="adresse_siege" value={data.adresse_siege}
            onChange={upd} placeholder="123 Rue du Commerce, Brazzaville" />
          <Field label="Adresse fiscale" name="adresse_fiscale" value={data.adresse_fiscale}
            onChange={upd} placeholder="(si différente du siège)" />
        </div>
      </Section>

      {/* ── Actionnaires ──────────────────────────────────────────────────── */}
      <Section title="Actionnaires & Associés" icon={Users}>
        <div>
          <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
            Liste des actionnaires / associés
          </label>
          <textarea
            value={data.actionnaires}
            onChange={e => upd('actionnaires', e.target.value)}
            placeholder="Nom Prénom — XX% des parts — Pièce d'identité n° XXXXXXXX&#10;Nom Prénom — XX% des parts — Pièce d'identité n° XXXXXXXX"
            rows={4}
            className="w-full px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 resize-none transition-all"
          />
        </div>
      </Section>

      {/* ── Documents ─────────────────────────────────────────────────────── */}
      <Section title="Documents officiels" icon={FileText}>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
              Statuts de l&apos;entreprise (URL ou référence)
            </label>
            <input type="url" value={data.documents_statuts} onChange={e => upd('documents_statuts', e.target.value)}
              placeholder="https://stockage.oraforme.com/statuts/..."
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] transition-all" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
              Documents fiscaux (URL ou référence)
            </label>
            <input type="url" value={data.documents_fiscaux} onChange={e => upd('documents_fiscaux', e.target.value)}
              placeholder="https://stockage.oraforme.com/fiscal/..."
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#CBD5E1] outline-none focus:border-[#F59E0B] transition-all" />
          </div>
        </div>
      </Section>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-[12px] text-red-600">{error}</p>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#94A3B8]">
          Toutes les modifications sont sauvegardées de manière sécurisée.
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-50"
          style={{ background: saved ? '#16A34A' : '#F59E0B' }}
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <><CheckCircle2 size={15} /> Sauvegardé</>
          ) : (
            <><Save size={15} /> Sauvegarder</>
          )}
        </button>
      </div>

    </div>
  )
}
