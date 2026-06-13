'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ChevronLeft, Save, Check, Loader2, Eye, EyeOff,
  HardDrive, AlertTriangle, ExternalLink, Zap,
  Cloud, Server, Globe, Database,
} from 'lucide-react'
import { useTenant } from '@/lib/hooks/useTenant'

interface StorageForm {
  provider:     string
  s3_endpoint:  string
  s3_bucket:    string
  s3_region:    string
  s3_access_key: string
  s3_secret_key: string
  public_url:   string
  actif:        boolean
}

const EMPTY: StorageForm = {
  provider: 's3', s3_endpoint: '', s3_bucket: '',
  s3_region: 'auto', s3_access_key: '', s3_secret_key: '',
  public_url: '', actif: false,
}

const PROVIDERS = [
  {
    id: 's3', name: 'AWS S3', icon: <Cloud size={16} />, color: '#FF9900',
    endpointHint: 'https://s3.{region}.amazonaws.com',
    regionHint: 'us-east-1, eu-west-1, ap-southeast-1…',
    docs: 'https://docs.aws.amazon.com/s3/',
  },
  {
    id: 'r2', name: 'Cloudflare R2', icon: <Globe size={16} />, color: '#F48120',
    endpointHint: 'https://{account-id}.r2.cloudflarestorage.com',
    regionHint: 'auto',
    docs: 'https://developers.cloudflare.com/r2/',
  },
  {
    id: 'wasabi', name: 'Wasabi', icon: <HardDrive size={16} />, color: '#00B140',
    endpointHint: 'https://s3.{region}.wasabisys.com',
    regionHint: 'eu-west-1, us-east-1, ap-southeast-1…',
    docs: 'https://docs.wasabi.com/',
  },
  {
    id: 'minio', name: 'MinIO (self-hosted)', icon: <Server size={16} />, color: '#C72E49',
    endpointHint: 'http://localhost:9000',
    regionHint: 'us-east-1 (défaut MinIO)',
    docs: 'https://min.io/docs/',
  },
]

const DOC_TYPES = [
  'CV & Candidatures', 'Contrats de travail', 'Factures & Devis',
  'Bulletins de paie', 'Documents CNSS', 'Documents fiscaux',
  'Photos profils', 'Documents cabinet', 'Documents hôtel',
  'Documents école', 'Documents clinique', 'GED générale',
]

function SecretInput({ label, value, onChange, placeholder, hint, required = false }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; hint?: string; required?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs font-semibold text-[#374151] mb-1">
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 pr-10 transition-all"
        />
        <button type="button" onClick={() => setShow(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {hint && <p className="text-[10px] text-[#94A3B8] mt-1">{hint}</p>}
    </div>
  )
}

function Input({ label, value, onChange, placeholder, hint, required = false }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; hint?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#374151] mb-1">
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="off"
        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
      />
      {hint && <p className="text-[10px] text-[#94A3B8] mt-1">{hint}</p>}
    </div>
  )
}

export default function StockageCloudPage() {
  const { tenantId }  = useTenant()
  const [form,   setForm]   = useState<StorageForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [error,   setError]   = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const selectedProvider = PROVIDERS.find(p => p.id === form.provider) ?? PROVIDERS[0]

  const load = useCallback(async () => {
    if (!tenantId) return
    try {
      const res = await fetch('/api/storage/config')
      const { config } = await res.json()
      if (config) setForm({ ...EMPTY, ...config })
    } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/api/storage/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur inconnue')
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/storage/config?test=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      setTestResult({ ok: !!json.ok, msg: json.message || json.error || 'Résultat inconnu' })
    } catch (err) {
      setTestResult({ ok: false, msg: (err as Error).message })
    } finally { setTesting(false) }
  }

  const set = (k: keyof StorageForm, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Back */}
      <Link href="/dashboard/parametres/integrations"
        className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors">
        <ChevronLeft size={14} /> Intégrations
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: '#F0F9FF' }}>
          <Database size={28} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Stockage Cloud</h1>
          <p className="text-sm text-[#64748B]">AWS S3 · Cloudflare R2 · Wasabi · MinIO</p>
        </div>
      </motion.div>

      {/* Activation */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex items-center justify-between bg-white border border-[#E2E8F0] rounded-2xl px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Activer le stockage cloud</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Les nouveaux documents seront stockés dans votre bucket. Les existants restent inchangés.
          </p>
        </div>
        <button onClick={() => set('actif', !form.actif)}
          className="relative w-11 h-6 rounded-full transition-colors duration-200"
          style={{ background: form.actif ? 'var(--primary)' : '#E2E8F0' }}>
          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: form.actif ? 'translateX(20px)' : 'none' }} />
        </button>
      </motion.div>

      {/* Provider selector */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <Cloud size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Fournisseur</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => set('provider', p.id)}
              className="flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
              style={{
                borderColor: form.provider === p.id ? p.color : '#E2E8F0',
                background:  form.provider === p.id ? `${p.color}10` : 'white',
              }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${p.color}18`, color: p.color }}>
                {p.icon}
              </div>
              <div>
                <p className="text-xs font-bold text-[#0F172A]">{p.name}</p>
                {form.provider === p.id && (
                  <a href={p.docs} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] text-[#2563EB] hover:underline flex items-center gap-0.5">
                    <ExternalLink size={8} /> Documentation
                  </a>
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Credentials */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <HardDrive size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Configuration</span>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Endpoint S3"
              value={form.s3_endpoint}
              onChange={v => set('s3_endpoint', v)}
              placeholder={selectedProvider.endpointHint}
              hint={`Exemple : ${selectedProvider.endpointHint}`}
              required
            />
          </div>
          <Input
            label="Bucket"
            value={form.s3_bucket}
            onChange={v => set('s3_bucket', v)}
            placeholder="mon-bucket-oraforme"
            hint="Nom exact du bucket créé chez votre fournisseur"
            required
          />
          <Input
            label="Région"
            value={form.s3_region}
            onChange={v => set('s3_region', v)}
            placeholder={selectedProvider.regionHint}
            hint={`Ex : ${selectedProvider.regionHint}`}
          />
          <SecretInput
            label="Access Key ID"
            value={form.s3_access_key}
            onChange={v => set('s3_access_key', v)}
            placeholder="AKIAIOSFODNN7EXAMPLE"
            required
          />
          <SecretInput
            label="Secret Access Key"
            value={form.s3_secret_key}
            onChange={v => set('s3_secret_key', v)}
            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            required
          />
          <div className="sm:col-span-2">
            <Input
              label="URL publique (CDN) — optionnel"
              value={form.public_url}
              onChange={v => set('public_url', v)}
              placeholder="https://cdn.votre-domaine.com"
              hint="Si défini, les liens de téléchargement utiliseront cette URL au lieu des presigned URLs"
            />
          </div>
        </div>
      </motion.div>

      {/* Documents couverts */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
        className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <Zap size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Documents centralisés</span>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DOC_TYPES.map(t => (
            <div key={t} className="flex items-center gap-2 text-xs text-[#374151] py-1">
              <div className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: form.actif ? 'var(--primary)' : '#CBD5E1' }} />
              {t}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Error / test result */}
      {error && (
        <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 text-sm text-[#DC2626]">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {testResult && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
          testResult.ok ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A]'
                        : 'bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]'
        }`}>
          {testResult.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {testResult.msg}
        </div>
      )}

      {/* Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="flex items-center gap-3">
        <button onClick={handleTest} disabled={testing || !form.s3_bucket}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-all disabled:opacity-40">
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Tester la connexion
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
          style={{ background: saved ? '#16A34A' : 'var(--primary)' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> :
           saved  ? <Check size={14} /> : <Save size={14} />}
          {saved ? 'Enregistré !' : 'Enregistrer'}
        </button>
      </motion.div>
    </div>
  )
}
