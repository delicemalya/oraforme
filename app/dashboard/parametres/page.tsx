'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, Save, Check, Loader2, FileText,
  Hash, Upload, X, Plus, Trash2, Layers,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

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

const CC_TYPES = [
  { value: 'direction',     label: 'Direction générale'  },
  { value: 'rh',            label: 'Ressources humaines' },
  { value: 'scolarite',     label: 'Scolarité'           },
  { value: 'informatique',  label: 'Informatique'        },
  { value: 'logistique',    label: 'Logistique'          },
  { value: 'commercial',    label: 'Commercial'          },
  { value: 'finance',       label: 'Finance & Compta'    },
  { value: 'autre',         label: 'Autre'               },
]
const CC_TYPE_LABELS: Record<string, string> = Object.fromEntries(CC_TYPES.map(t => [t.value, t.label]))

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <Icon size={13} className="text-[#F0A30A]" />
        <span className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">{title}</span>
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
      <label className="block text-xs text-[#8B949E] mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea rows={2} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#F0A30A]/50 resize-none" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#F0A30A]/50" />
      )}
    </div>
  )
}

export default function ParametresPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
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

  const load = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase.from('entreprise_config').select('*').eq('tenant_id', tenantId).maybeSingle()
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
    if (!tenantId) return 'Tenant non chargé'

    const { data: existing, error: selErr } = await supabase
      .from('entreprise_config')
      .select('id')
      .eq('tenant_id', tenantId)
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
      setUploadError(`Upload échoué : ${upErr.message}`)
      setUploadingLogo(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)

    // Persist immediately so the logo survives page refresh
    const dbErr = await persistConfig({ logo_url: publicUrl })
    if (dbErr) {
      setUploadError(`Logo uploadé mais non sauvegardé : ${dbErr}`)
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
      <div className="flex items-center justify-center h-64 text-[#8B949E]">
        <Loader2 className="animate-spin mr-2" size={18} /> Chargement…
      </div>
    )
  }

  const btnStyle = {
    background: saved ? 'linear-gradient(135deg,#2EA043,#238636)' : 'linear-gradient(135deg,#F0A30A,#d4880a)',
    color: '#0D1117' as const,
    boxShadow: saved ? '0 0 16px #2EA04340' : '0 0 16px #F0A30A35',
  }

  return (
    <div className="space-y-4 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Paramètres</h1>
          <p className="text-xs text-[#8B949E] mt-0.5">Configuration de l&apos;entreprise et de la facturation</p>
        </div>
        <motion.button onClick={save} disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50" style={btnStyle}>
          {saving ? <Loader2 className="animate-spin" size={15} /> : saved ? <><Check size={15} /> Enregistré !</> : <><Save size={15} /> Enregistrer</>}
        </motion.button>
      </div>

      {/* ── LOGO SECTION ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <Upload size={13} className="text-[#F0A30A]" />
          <span className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">Logo de l&apos;entreprise</span>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4">
            {/* Preview box */}
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-white/[0.08]"
              style={{ background: cfg.logo_url ? 'transparent' : 'rgba(240,163,10,0.1)' }}>
              {cfg.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cfg.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl font-black text-[#F0A30A]">
                  {cfg.nom ? cfg.nom.charAt(0).toUpperCase() : 'O'}
                </span>
              )}
            </div>

            {/* Upload controls */}
            <div className="flex-1">
              <p className="text-sm font-semibold text-white mb-0.5">{cfg.nom || 'Votre entreprise'}</p>
              <p className="text-xs text-[#8B949E] mb-2">{cfg.ville}{cfg.pays ? `, ${cfg.pays}` : ''}</p>

              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                <motion.button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#F0A30A,#d4880a)', color: '#0D1117' }}>
                  {uploadingLogo ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
                  {uploadingLogo ? 'Upload en cours…' : cfg.logo_url ? 'Changer le logo' : 'Uploader un logo'}
                </motion.button>

                {cfg.logo_url && (
                  <button onClick={() => set('logo_url', '')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                    <X size={12} /> Supprimer
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[#484F58] mt-1.5">PNG, JPG, WEBP ou SVG · max 2 Mo</p>
            </div>
          </div>

          {uploadError && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 leading-relaxed">
              {uploadError}
            </div>
          )}

          {/* URL fallback */}
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <label className="block text-xs text-[#8B949E] mb-1">Ou collez directement une URL d&apos;image</label>
            <input type="url" value={cfg.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://…/logo.png"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#F0A30A]/50" />
          </div>
        </div>
      </div>

      {/* ── IDENTITY ─────────────────────────────────────────────────────────── */}
      <Section title="Identité de l'entreprise" icon={Building2}>
        <Field label="Nom de l'entreprise" value={cfg.nom}       onChange={v => set('nom', v)}       placeholder="SARL Congo Services" />
        <Field label="Adresse"             value={cfg.adresse}   onChange={v => set('adresse', v)}   placeholder="123 Avenue de l'Indépendance" full />
        <Field label="Ville"               value={cfg.ville}     onChange={v => set('ville', v)}     placeholder="Pointe-Noire" />
        <Field label="Pays"                value={cfg.pays}      onChange={v => set('pays', v)}      placeholder="Congo-Brazzaville" />
        <Field label="Téléphone"           value={cfg.telephone} onChange={v => set('telephone', v)} placeholder="+242 06 000 0000" />
        <Field label="Email"               value={cfg.email}     onChange={v => set('email', v)}     placeholder="contact@entreprise.cg" type="email" />
      </Section>

      {/* ── LEGAL — footer facture ────────────────────────────────────────── */}
      <Section title="Pied de page facture — Informations légales" icon={Hash}>
        <Field label="RCCM"           value={cfg.rccm}    onChange={v => set('rccm', v)}    placeholder="PNR-24-B-12345" />
        <Field label="SCIET"          value={cfg.sciet}   onChange={v => set('sciet', v)}   placeholder="24-B-12345" />
        <Field label="SCIEN"          value={cfg.scien}   onChange={v => set('scien', v)}   placeholder="Numéro SCIEN" />
        <Field label="Capital social" value={cfg.capital} onChange={v => set('capital', v)} placeholder="1 000 000 FCFA" />
        <Field label="RIB / Coordonnées bancaires (Payment Method)" value={cfg.rib} onChange={v => set('rib', v)}
          placeholder="LCB · Compte N° 000-000-000 / Clé 00" full />
        <Field label='Message "Merci" affiché en bas de chaque facture' value={cfg.message_defaut}
          onChange={v => set('message_defaut', v)} placeholder="Merci pour votre confiance !" type="textarea" full />
      </Section>

      {/* ── BILLING PREFS ─────────────────────────────────────────────────── */}
      <Section title="Préférences facturation" icon={FileText}>
        <Field label="Préfixe N° facture" value={cfg.prefixe_facture} onChange={v => set('prefixe_facture', v)} placeholder="FAC" />
        <Field label="Devise"             value={cfg.devise}          onChange={v => set('devise', v)}          placeholder="FCFA" />
        <div>
          <label className="block text-xs text-[#8B949E] mb-1.5">Délai de paiement</label>
          <select value={cfg.delai_paiement} onChange={e => set('delai_paiement', Number(e.target.value))}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#F0A30A]/50">
            {[15, 30, 45, 60, 90].map(d => <option key={d} value={d} className="bg-[#161B22]">{d} jours</option>)}
          </select>
        </div>
      </Section>

      {/* ── CENTRES DE COÛTS ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <Layers size={13} className="text-[#F0A30A]" />
          <span className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">Centres de coûts</span>
          <span className="ml-auto text-[10px] text-[#484F58]">{costCenters.length} centre{costCenters.length > 1 ? 's' : ''}</span>
        </div>
        <div className="p-4 space-y-3">
          {ccLoading ? (
            <div className="flex items-center gap-2 text-sm text-[#8B949E]"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
          ) : costCenters.length === 0 ? (
            <p className="text-xs text-[#484F58] text-center py-3">Aucun centre — créez-en un ci-dessous</p>
          ) : (
            <div className="space-y-1.5">
              {costCenters.map(cc => (
                <div key={cc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-xs font-mono font-bold text-[#F0A30A] w-12 shrink-0">{cc.code}</span>
                  <span className="text-xs text-[#E6EDF3] flex-1 truncate">{cc.nom}</span>
                  <span className="text-[10px] text-[#484F58] shrink-0">{CC_TYPE_LABELS[cc.type] ?? cc.type}</span>
                  <button onClick={() => deleteCostCenter(cc.id)} className="shrink-0 text-[#484F58] hover:text-[#F01F38] transition-colors ml-1">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-[10px] text-[#6E7681] uppercase tracking-wider mb-2">Ajouter un centre</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input value={ccForm.code} onChange={e => setCcForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Code (RH…)" maxLength={10}
                className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#F0A30A]/50" />
              <input value={ccForm.nom} onChange={e => setCcForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="Nom du centre"
                className="col-span-2 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#F0A30A]/50" />
            </div>
            <div className="flex gap-2">
              <select value={ccForm.type} onChange={e => setCcForm(f => ({ ...f, type: e.target.value }))}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F0A30A]/50">
                {CC_TYPES.map(t => <option key={t.value} value={t.value} className="bg-[#161B22]">{t.label}</option>)}
              </select>
              <button onClick={saveCostCenter} disabled={ccSaving || !ccForm.code || !ccForm.nom}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 shrink-0"
                style={{ background: 'linear-gradient(135deg,#F0A30A,#d4880a)', color: '#0D1117' }}>
                {ccSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FISCAL INFO ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#F0A30A]/20 p-4" style={{ background: 'rgba(240,163,10,0.03)' }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F0A30A]/15 flex items-center justify-center shrink-0 mt-0.5">
            <FileText size={14} className="text-[#F0A30A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Logique fiscale Congo-Brazzaville</p>
            <p className="text-xs text-[#8B949E] leading-relaxed">
              Toutes les factures appliquent automatiquement :{' '}
              <strong className="text-white">TVA 18 %</strong> sur le HT +{' '}
              <strong className="text-white">Centime Additionnel (CA) 5 %</strong> de la TVA.<br />
              Formule : TTC = HT + (HT × 0,18) + (HT × 0,18 × 0,05)
            </p>
          </div>
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 leading-relaxed">
          Erreur de sauvegarde : {saveError}
        </div>
      )}

      {/* Bottom save */}
      <div className="flex justify-end pb-2">
        <motion.button onClick={save} disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm disabled:opacity-50" style={btnStyle}>
          {saving ? <Loader2 className="animate-spin" size={15} /> : saved ? <><Check size={15} /> Enregistré !</> : <><Save size={15} /> Enregistrer les paramètres</>}
        </motion.button>
      </div>
    </div>
  )
}
