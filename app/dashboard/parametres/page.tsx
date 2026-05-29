'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, Save, Check, Loader2, FileText,
  Hash, Upload, X, Plus, Trash2, Layers,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'

interface Config {
  logo_url:        string
  nom:             string
  adresse:         string
  telephone:       string
  email:           string
  ville:           string
  pays:            string
  rccm:            string
  sciet:           string
  scien:           string
  capital:         string
  rib:             string
  prefixe_facture: string
  devise:          string
  delai_paiement:  number
  message_defaut:  string
}

const EMPTY: Config = {
  logo_url: '', nom: '', adresse: '', telephone: '', email: '',
  ville: 'Pointe-Noire', pays: 'Congo-Brazzaville',
  rccm: '', sciet: '', scien: '', capital: '', rib: '',
  prefixe_facture: 'FAC', devise: 'FCFA', delai_paiement: 30,
  message_defaut: 'Merci pour votre confiance !',
}

type CostCenter = { id: string; code: string; nom: string; type: string; actif: boolean }

const CC_TYPE_VALUES = [
  'direction', 'rh', 'scolarite', 'informatique',
  'logistique', 'commercial', 'finance', 'autre',
] as const

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2" style={{ background: '#F9FAFB' }}>
        <Icon size={13} className="text-[#DC2626]" />
        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', full = false }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea rows={2} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7] resize-none" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7]" />
      )}
    </div>
  )
}

export default function ParametresPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t } = useLocale()
  const [cfg,           setCfg]           = useState<Config>(EMPTY)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [saveError,     setSaveError]     = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadError,   setUploadError]   = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [ccLoading,   setCcLoading]   = useState(false)
  const [ccForm,      setCcForm]      = useState({ code: '', nom: '', type: 'autre' })
  const [ccSaving,    setCcSaving]    = useState(false)

  const CC_TYPES = CC_TYPE_VALUES.map(value => ({
    value,
    label: t(`params.cc.${value}`),
  }))
  const CC_TYPE_LABELS: Record<string, string> = Object.fromEntries(CC_TYPES.map(tp => [tp.value, tp.label]))

  const load = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase.from('entreprise_config').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (data) {
      setCfg({
        logo_url:        data.logo_url        ?? '',
        nom:             data.nom             ?? '',
        adresse:         data.adresse         ?? '',
        telephone:       data.telephone       ?? '',
        email:           data.email           ?? '',
        ville:           data.ville           ?? 'Pointe-Noire',
        pays:            data.pays            ?? 'Congo-Brazzaville',
        rccm:            data.rccm            ?? '',
        sciet:           data.sciet           ?? '',
        scien:           data.scien           ?? '',
        capital:         data.capital         ?? '',
        rib:             data.rib             ?? '',
        prefixe_facture: data.prefixe_facture ?? 'FAC',
        devise:          data.devise          ?? 'FCFA',
        delai_paiement:  data.delai_paiement  ?? 30,
        message_defaut:  data.message_defaut  ?? 'Merci pour votre confiance !',
      })
    }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const loadCostCenters = useCallback(async () => {
    if (!tenantId) return
    setCcLoading(true)
    const { data } = await supabase.from('cost_centers').select('*').eq('tenant_id', tenantId).order('code')
    setCostCenters(data ?? [])
    setCcLoading(false)
  }, [tenantId])

  useEffect(() => { loadCostCenters() }, [loadCostCenters])

  async function saveCostCenter() {
    if (!tenantId || !ccForm.code || !ccForm.nom) return
    setCcSaving(true)
    await supabase.from('cost_centers').insert({ tenant_id: tenantId, ...ccForm, actif: true })
    setCcForm({ code: '', nom: '', type: 'autre' })
    setCcSaving(false)
    loadCostCenters()
  }

  async function deleteCostCenter(id: string) {
    await supabase.from('cost_centers').delete().eq('id', id)
    loadCostCenters()
  }

  function set(key: keyof Config, val: string | number) {
    setCfg(p => ({ ...p, [key]: val }))
  }

  // ── DB helper: UPDATE if row exists, INSERT otherwise ─────────────────────
  // Avoids upsert which can silently fail with certain RLS configurations.

  async function persistConfig(data: Record<string, unknown>): Promise<string | null> {
    if (!tenantId) return t('params.tenantNotLoaded')

    const { data: existing, error: selErr } = await supabase
      .from('entreprise_config')
      .select('id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (selErr) return selErr.message

    if (existing) {
      const { error } = await supabase
        .from('entreprise_config')
        .update(data)
        .eq('tenant_id', tenantId)
      return error?.message ?? null
    } else {
      const { error } = await supabase
        .from('entreprise_config')
        .insert({ tenant_id: tenantId, ...data })
      return error?.message ?? null
    }
  }

  // ── Logo upload ────────────────────────────────────────────────────────────

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return
    e.target.value = ''

    const ext     = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const allowed = ['png', 'jpg', 'jpeg', 'webp', 'svg']
    if (!allowed.includes(ext)) {
      setUploadError('Format non supporté. Utilisez PNG, JPG, WEBP ou SVG.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Fichier trop volumineux (max 2 Mo).')
      return
    }

    setUploadError('')
    setUploadingLogo(true)

    const path = `${tenantId}/logo.${ext}`
    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) {
      setUploadError(`${t('params.uploadFailed')} ${upErr.message}`)
      setUploadingLogo(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)

    // Persist immediately so the logo survives page refresh
    const dbErr = await persistConfig({ logo_url: publicUrl })
    if (dbErr) {
      setUploadError(`${t('params.logoSavedError')} ${dbErr}`)
      setUploadingLogo(false)
      return
    }

    set('logo_url', publicUrl)
    setUploadingLogo(false)
    window.dispatchEvent(new CustomEvent('oraforme:config-saved', { detail: { logo_url: publicUrl } }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    if (!tenantId) return
    setSaving(true)
    setSaveError('')
    const errMsg = await persistConfig({ ...cfg })
    setSaving(false)
    if (errMsg) {
      setSaveError(errMsg)
      return
    }
    setSaved(true)
    window.dispatchEvent(new CustomEvent('oraforme:config-saved', { detail: { logo_url: cfg.logo_url } }))
    setTimeout(() => setSaved(false), 2500)
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> {t('common.loading')}
      </div>
    )
  }

  const btnStyle = {
    background: saved ? '#238636' : '#DC2626',
    color: '#0F172A' as const,
    boxShadow: saved ? '0 0 16px #16A34A40' : '0 0 16px #DC262635',
  }

  return (
    <div className="space-y-4 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#101729]">{t('params.title')}</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('params.subtitle')}</p>
        </div>
        <motion.button onClick={save} disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50" style={btnStyle}>
          {saving ? <Loader2 className="animate-spin" size={15} /> : saved ? <><Check size={15} /> {t('params.saved')}</> : <><Save size={15} /> {t('params.save')}</>}
        </motion.button>
      </div>

      {/* ── LOGO SECTION ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2" style={{ background: '#F9FAFB' }}>
          <Upload size={13} className="text-[#DC2626]" />
          <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('params.logoSection')}</span>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4">
            {/* Preview box */}
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-[var(--border)]"
              style={{ background: cfg.logo_url ? 'transparent' : 'rgba(240,163,10,0.1)' }}>
              {cfg.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cfg.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl font-black text-[#DC2626]">
                  {cfg.nom ? cfg.nom.charAt(0).toUpperCase() : 'O'}
                </span>
              )}
            </div>

            {/* Upload controls */}
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#101729] mb-0.5">{cfg.nom || t('params.yourCompany')}</p>
              <p className="text-xs text-[var(--text-secondary)] mb-2">{cfg.ville}{cfg.pays ? `, ${cfg.pays}` : ''}</p>

              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                <motion.button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#DC2626', color: '#0F172A' }}>
                  {uploadingLogo ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
                  {uploadingLogo ? t('params.uploading') : cfg.logo_url ? t('params.changeLogo') : t('params.uploadLogo')}
                </motion.button>

                {cfg.logo_url && (
                  <button onClick={() => set('logo_url', '')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                    <X size={12} /> {t('common.delete')}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">{t('params.logoFormats')}</p>
            </div>
          </div>

          {uploadError && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 leading-relaxed">
              {uploadError}
            </div>
          )}

          {/* URL fallback */}
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('params.imageUrl')}</label>
            <input type="url" value={cfg.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://…/logo.png"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7]" />
          </div>
        </div>
      </div>

      {/* ── IDENTITY ─────────────────────────────────────────────────────────── */}
      <Section title={t('params.identity')} icon={Building2}>
        <Field label={t('params.companyName')}  value={cfg.nom}       onChange={v => set('nom', v)}       placeholder="SARL Congo Services" />
        <Field label={t('params.address')}      value={cfg.adresse}   onChange={v => set('adresse', v)}   placeholder="123 Avenue de l'Indépendance" full />
        <Field label={t('params.city')}         value={cfg.ville}     onChange={v => set('ville', v)}     placeholder="Pointe-Noire" />
        <Field label={t('params.country')}      value={cfg.pays}      onChange={v => set('pays', v)}      placeholder="Congo-Brazzaville" />
        <Field label={t('params.phone')}        value={cfg.telephone} onChange={v => set('telephone', v)} placeholder="+242 06 000 0000" />
        <Field label={t('params.email')}        value={cfg.email}     onChange={v => set('email', v)}     placeholder="contact@entreprise.cg" type="email" />
      </Section>

      {/* ── LEGAL — footer facture ────────────────────────────────────────── */}
      <Section title={t('params.legal')} icon={Hash}>
        <Field label="RCCM"                      value={cfg.rccm}    onChange={v => set('rccm', v)}    placeholder="PNR-24-B-12345" />
        <Field label="SCIET"                     value={cfg.sciet}   onChange={v => set('sciet', v)}   placeholder="24-B-12345" />
        <Field label={t('params.scien')}         value={cfg.scien}   onChange={v => set('scien', v)}   placeholder={t('params.scien')} />
        <Field label={t('params.socialCapital')} value={cfg.capital} onChange={v => set('capital', v)} placeholder="1 000 000 FCFA" />
        <Field label={t('params.rib')}           value={cfg.rib}     onChange={v => set('rib', v)}
          placeholder="LCB · Compte N° 000-000-000 / Clé 00" full />
        <Field label={t('params.thankMsg')}      value={cfg.message_defaut}
          onChange={v => set('message_defaut', v)} placeholder="Merci pour votre confiance !" type="textarea" full />
      </Section>

      {/* ── BILLING PREFS ─────────────────────────────────────────────────── */}
      <Section title={t('params.billingPrefs')} icon={FileText}>
        <Field label={t('params.invoicePrefix')} value={cfg.prefixe_facture} onChange={v => set('prefixe_facture', v)} placeholder="FAC" />
        <Field label={t('params.currency')}      value={cfg.devise}          onChange={v => set('devise', v)}          placeholder="FCFA" />
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1.5">{t('params.paymentDelay')}</label>
          <select value={cfg.delai_paiement} onChange={e => set('delai_paiement', Number(e.target.value))}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
            {[15, 30, 45, 60, 90].map(d => <option key={d} value={d} className="bg-[var(--card-bg)]">{d} {t('params.days')}</option>)}
          </select>
        </div>
      </Section>

      {/* ── CENTRES DE COÛTS ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2" style={{ background: '#F9FAFB' }}>
          <Layers size={13} className="text-[#DC2626]" />
          <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('params.costCenters')}</span>
          <span className="ml-auto text-[10px] text-[var(--text-secondary)]">{costCenters.length} {costCenters.length > 1 ? t('params.centers') : t('params.center')}</span>
        </div>
        <div className="p-4 space-y-3">
          {ccLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Loader2 size={14} className="animate-spin" /> {t('common.loading')}</div>
          ) : costCenters.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] text-center py-3">{t('params.noCostCenter')}</p>
          ) : (
            <div className="space-y-1.5">
              {costCenters.map(cc => (
                <div key={cc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--border)]" style={{ background: '#F9FAFB' }}>
                  <span className="text-xs font-mono font-bold text-[#DC2626] w-12 shrink-0">{cc.code}</span>
                  <span className="text-xs text-[var(--text)] flex-1 truncate">{cc.nom}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] shrink-0">{CC_TYPE_LABELS[cc.type] ?? cc.type}</span>
                  <button onClick={() => deleteCostCenter(cc.id)} className="shrink-0 text-[var(--text-secondary)] hover:text-[#DC2626] transition-colors ml-1">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-3">
            <p className="text-[10px] text-[#6E7681] uppercase tracking-wider mb-2">{t('params.addCenter')}</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input value={ccForm.code} onChange={e => setCcForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder={t('params.codePlaceholder')} maxLength={10}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7]" />
              <input value={ccForm.nom} onChange={e => setCcForm(f => ({ ...f, nom: e.target.value }))}
                placeholder={t('params.centerName')}
                className="col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7]" />
            </div>
            <div className="flex gap-2">
              <select value={ccForm.type} onChange={e => setCcForm(f => ({ ...f, type: e.target.value }))}
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                {CC_TYPES.map(tp => <option key={tp.value} value={tp.value} className="bg-[var(--card-bg)]">{tp.label}</option>)}
              </select>
              <button onClick={saveCostCenter} disabled={ccSaving || !ccForm.code || !ccForm.nom}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 shrink-0"
                style={{ background: '#DC2626', color: '#0F172A' }}>
                {ccSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {t('common.add')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FISCAL INFO ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#DC2626]/20 p-4" style={{ background: 'rgba(240,163,10,0.03)' }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#DC2626]/15 flex items-center justify-center shrink-0 mt-0.5">
            <FileText size={14} className="text-[#DC2626]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#101729] mb-1">{t('params.fiscalTitle')}</p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Toutes les factures appliquent automatiquement :{' '}
              <strong className="text-[#101729]">TVA 18 %</strong> sur le HT +{' '}
              <strong className="text-[#101729]">Centime Additionnel (CA) 5 %</strong> de la TVA.<br />
              Formule : TTC = HT + (HT × 0,18) + (HT × 0,18 × 0,05)
            </p>
          </div>
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 leading-relaxed">
          {t('params.saveError')} {saveError}
        </div>
      )}

      {/* Bottom save */}
      <div className="flex justify-end pb-2">
        <motion.button onClick={save} disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm disabled:opacity-50" style={btnStyle}>
          {saving ? <Loader2 className="animate-spin" size={15} /> : saved ? <><Check size={15} /> {t('params.saved')}</> : <><Save size={15} /> {t('params.saveParams')}</>}
        </motion.button>
      </div>
    </div>
  )
}
