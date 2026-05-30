'use client'

/**
 * Profil Entreprise — page universelle (tous secteurs)
 * Paramètres marque, coordonnées, logo, devise, secteur.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useLocale } from '@/lib/hooks/useLocale'
import ERPPageLayout, { ERPSectionCard } from '@/components/ui/ERPPageLayout'
import { Building2, Save, Upload, Globe, Phone, Mail, MapPin, CheckCircle } from 'lucide-react'
import { SECTOR_LABELS } from '@/lib/erp-sectors'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantProfile {
  id:                string
  nom_entreprise:    string
  email_contact?:    string
  telephone?:        string
  adresse?:          string
  ville?:            string
  pays?:             string
  secteur_activite?: string
  devise?:           string
  logo_url?:         string
  site_web?:         string
  description?:      string
  plan?:             string
}

const DEVISES = ['FCFA', 'USD', 'EUR', 'XOF', 'XAF', 'GNF', 'CDF']

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const { tenant, reload: refreshTenant } = useTenantContext()
  const { t } = useLocale()

  const [profile, setProfile]   = useState<TenantProfile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [saved,   setSaved]     = useState(false)

  const [form, setForm] = useState({
    nom_entreprise: '', email_contact: '', telephone: '',
    adresse: '', ville: '', pays: '', devise: 'FCFA',
    logo_url: '', site_web: '', description: '',
  })

  async function loadProfile() {
    setLoading(true)
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant!.tenantId)
      .single()

    if (data) {
      setProfile(data as TenantProfile)
      setForm({
        nom_entreprise: data.nom_entreprise ?? '',
        email_contact:  data.email_contact  ?? '',
        telephone:      data.telephone      ?? '',
        adresse:        data.adresse        ?? '',
        ville:          data.ville          ?? '',
        pays:           data.pays           ?? '',
        devise:         data.devise         ?? 'FCFA',
        logo_url:       data.logo_url       ?? '',
        site_web:       data.site_web       ?? '',
        description:    data.description    ?? '',
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!tenant) return
    loadProfile()
  }, [tenant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('tenants')
      .update({
        nom_entreprise: form.nom_entreprise.trim(),
        email_contact:  form.email_contact.trim()  || null,
        telephone:      form.telephone.trim()       || null,
        adresse:        form.adresse.trim()         || null,
        ville:          form.ville.trim()           || null,
        pays:           form.pays.trim()            || null,
        devise:         form.devise,
        logo_url:       form.logo_url.trim()        || null,
        site_web:       form.site_web.trim()        || null,
        description:    form.description.trim()     || null,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', tenant!.tenantId)

    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      if (typeof refreshTenant === 'function') refreshTenant()
    }
  }

  const sectorLabel = profile?.secteur_activite
    ? (SECTOR_LABELS[profile.secteur_activite] ?? profile.secteur_activite)
    : '—'

  return (
    <ERPPageLayout
      title={t('profil.title')}
      subtitle={t('profil.subtitle')}
      icon={<Building2 size={18} />}
      color="#2563EB"
    >
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-[#F1F5F9] rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">

          {/* Identité */}
          <ERPSectionCard title={t('profil.identity')}>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Logo preview */}
              {form.logo_url && (
                <div className="sm:col-span-2 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-contain border border-[#E2E8F0] bg-[#F8FAFC] p-2" />
                  <div>
                    <p className="text-[13px] font-bold text-[#0F172A]">{form.nom_entreprise}</p>
                    <p className="text-[11px] text-[#64748B]">{sectorLabel}</p>
                    {profile?.plan && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mt-1 inline-block">
                        {profile.plan.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <Field label={`${t('profil.companyName')} *`} required>
                <input required value={form.nom_entreprise}
                  onChange={e => setForm(p => ({...p, nom_entreprise: e.target.value}))}
                  className={inputCls} placeholder="Ma Société" />
              </Field>

              <Field label={t('profil.sector')}>
                <input readOnly value={sectorLabel}
                  className={`${inputCls} bg-[#F8FAFC] cursor-not-allowed`} />
              </Field>

              <Field label={t('profil.logoUrl')}>
                <div className="relative">
                  <Upload size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input value={form.logo_url}
                    onChange={e => setForm(p => ({...p, logo_url: e.target.value}))}
                    className={`${inputCls} pl-8`} placeholder="https://..." />
                </div>
              </Field>

              <Field label={t('profil.website')}>
                <div className="relative">
                  <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input value={form.site_web}
                    onChange={e => setForm(p => ({...p, site_web: e.target.value}))}
                    className={`${inputCls} pl-8`} placeholder="https://www.example.com" />
                </div>
              </Field>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide block mb-1">{t('profil.description')}</label>
                <textarea value={form.description}
                  onChange={e => setForm(p => ({...p, description: e.target.value}))}
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder={t('profil.descPlaceholder')} />
              </div>
            </div>
          </ERPSectionCard>

          {/* Contact */}
          <ERPSectionCard title={t('profil.contact')}>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('profil.emailContact')}>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input type="email" value={form.email_contact}
                    onChange={e => setForm(p => ({...p, email_contact: e.target.value}))}
                    className={`${inputCls} pl-8`} placeholder="contact@entreprise.com" />
                </div>
              </Field>

              <Field label={t('profil.telephone')}>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input value={form.telephone}
                    onChange={e => setForm(p => ({...p, telephone: e.target.value}))}
                    className={`${inputCls} pl-8`} placeholder="+243 8x xxx xxxx" />
                </div>
              </Field>

              <Field label={t('profil.address')}>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input value={form.adresse}
                    onChange={e => setForm(p => ({...p, adresse: e.target.value}))}
                    className={`${inputCls} pl-8`} placeholder="123 Avenue..." />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('profil.city')}>
                  <input value={form.ville}
                    onChange={e => setForm(p => ({...p, ville: e.target.value}))}
                    className={inputCls} placeholder="Kinshasa" />
                </Field>
                <Field label={t('profil.country')}>
                  <input value={form.pays}
                    onChange={e => setForm(p => ({...p, pays: e.target.value}))}
                    className={inputCls} placeholder="DRC" />
                </Field>
              </div>

              <Field label={t('profil.currency')}>
                <select value={form.devise}
                  onChange={e => setForm(p => ({...p, devise: e.target.value}))}
                  className={`${inputCls} bg-white`}>
                  {DEVISES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
          </ERPSectionCard>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <div className="flex items-center gap-1.5 text-green-600 text-[13px] font-semibold">
                <CheckCircle size={15} />
                {t('profil.updated')}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white rounded-xl text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Save size={14} />
              {saving ? t('profil.saving') : t('profil.save')}
            </button>
          </div>
        </form>
      )}
    </ERPPageLayout>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300'

function Field({ label, children, required }: {
  label: string; children: React.ReactNode; required?: boolean
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide block mb-1">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  )
}
