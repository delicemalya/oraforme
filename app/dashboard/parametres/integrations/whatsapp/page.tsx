'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ChevronLeft, Save, Check, Loader2, Eye, EyeOff,
  MessageCircle, AlertTriangle, ExternalLink,
  FileText, Users, Building2, BarChart2, Zap,
} from 'lucide-react'
import { useTenant } from '@/lib/hooks/useTenant'

interface WaFormState {
  phone_number_id:     string
  business_account_id: string
  access_token:        string
  webhook_secret:      string
  from_phone:          string
  actif:               boolean
}

const EMPTY: WaFormState = {
  phone_number_id: '',
  business_account_id: '',
  access_token: '',
  webhook_secret: '',
  from_phone: '',
  actif: false,
}

function InputField({
  label, value, onChange, placeholder, type = 'text', required = false,
  hint, secret = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean
  hint?: string; secret?: boolean
}) {
  const [show, setShow] = useState(false)

  return (
    <div>
      <label className="block text-xs font-semibold text-[#374151] mb-1">
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type={secret && !show ? 'password' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 transition-all pr-10"
          autoComplete="off"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-[#94A3B8] mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
        <Icon size={14} className="text-[#25D366]" />
        <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">{title}</span>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

const TRIGGERS = [
  { icon: <FileText size={14} />, label: 'Factures émises',        desc: 'Envoi automatique à la création ou validation' },
  { icon: <FileText size={14} />, label: 'Devis acceptés',          desc: 'Notification au client à l\'acceptation' },
  { icon: <AlertTriangle size={14} />, label: 'Rappels de paiement', desc: 'Relance automatique pour factures impayées' },
  { icon: <Users size={14} />,    label: 'Bulletins de paie',        desc: 'Notification employé à la génération' },
  { icon: <Users size={14} />,    label: 'Recrutement',              desc: 'Convocations, résultats entretiens' },
  { icon: <Building2 size={14} />,label: 'Alertes fiscales',         desc: 'TVA, CNSS, DAS, patente, IS, IRPP' },
]

export default function WhatsAppSettingsPage() {
  const { tenantId } = useTenant()
  const [form,    setForm]    = useState<WaFormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/config')
      const { config } = await res.json()
      if (config) setForm({ ...EMPTY, ...config })
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/api/whatsapp/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur inconnue')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!form.from_phone) {
      setTestResult({ ok: false, msg: 'Renseignez le numéro d\'expéditeur d\'abord' })
      return
    }
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type:        'invoice',
          to:          form.from_phone,
          invoiceNumber: 'TEST-001',
          amount:      '0 FCFA',
          clientName:  'Test Oraforme',
          companyName: 'Oraforme',
        }),
      })
      const json = await res.json()
      if (res.ok) setTestResult({ ok: true,  msg: `Message envoyé ! ID: ${json.whatsapp_id ?? '—'}` })
      else        setTestResult({ ok: false, msg: json.error ?? 'Échec' })
    } catch (err) {
      setTestResult({ ok: false, msg: (err as Error).message })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={28} className="animate-spin text-[#25D366]" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/parametres/integrations"
          className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ChevronLeft size={14} /> Intégrations
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[#F0FDF4]">
          <svg viewBox="0 0 24 24" fill="#25D366" className="w-8 h-8">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">WhatsApp Business</h1>
          <p className="text-sm text-[#64748B]">Intégration via Meta Cloud API</p>
        </div>
      </motion.div>

      {/* ── Activation toggle ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex items-center justify-between bg-white border border-[#E2E8F0] rounded-2xl px-5 py-4"
      >
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Activer les notifications WhatsApp</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">Les messages ne seront envoyés que si cette option est activée</p>
        </div>
        <button
          onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
          className="relative w-11 h-6 rounded-full transition-colors duration-200"
          style={{ background: form.actif ? '#25D366' : '#E2E8F0' }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: form.actif ? 'translateX(20px)' : 'none' }}
          />
        </button>
      </motion.div>

      {/* ── Credentials ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Section title="Identifiants API Meta" icon={MessageCircle}>
          <InputField
            label="Phone Number ID"
            value={form.phone_number_id}
            onChange={v => setForm(f => ({ ...f, phone_number_id: v }))}
            placeholder="123456789012345"
            hint="Trouvez-le dans Meta for Developers → WhatsApp → Getting Started"
            required
          />
          <InputField
            label="Business Account ID (WABA)"
            value={form.business_account_id}
            onChange={v => setForm(f => ({ ...f, business_account_id: v }))}
            placeholder="123456789012345"
            hint="WhatsApp Business Account ID dans le Business Manager"
          />
          <InputField
            label="Access Token (permanent)"
            value={form.access_token}
            onChange={v => setForm(f => ({ ...f, access_token: v }))}
            placeholder="EAAxxxxxxxxxxxxxxxxx"
            hint="Token permanent depuis Meta for Developers → Settings → System Users"
            secret
            required
          />
          <InputField
            label="Webhook Secret (Verify Token)"
            value={form.webhook_secret}
            onChange={v => setForm(f => ({ ...f, webhook_secret: v }))}
            placeholder="mon_secret_unique_12345"
            hint="Une chaîne aléatoire que vous choisissez — utilisée pour valider le webhook"
            secret
          />
          <div className="sm:col-span-2">
            <InputField
              label="Numéro expéditeur (E.164)"
              value={form.from_phone}
              onChange={v => setForm(f => ({ ...f, from_phone: v }))}
              placeholder="+242XXXXXXXXX"
              hint="Numéro WhatsApp Business enregistré sur Meta — format international"
            />
          </div>
        </Section>
      </motion.div>

      {/* ── Webhook URL ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-5"
      >
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-[#16A34A]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#16A34A]">URL Webhook (lecture seule)</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#BBF7D0] rounded-xl px-3 py-2.5">
          <code className="text-xs text-[#0F172A] flex-1 truncate">
            {origin}/api/whatsapp/webhook
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(`${origin}/api/whatsapp/webhook`)}
            className="text-[10px] text-[#16A34A] hover:text-[#15803D] font-semibold shrink-0"
          >
            Copier
          </button>
        </div>
        <p className="text-[10px] text-[#64748B] mt-2">
          Collez cette URL dans Meta for Developers → WhatsApp → Configuration → Webhook URL.
          Le Verify Token = votre Webhook Secret ci-dessus.
        </p>
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-[#2563EB] hover:underline mt-1"
        >
          <ExternalLink size={10} /> Guide officiel Meta Cloud API
        </a>
      </motion.div>

      {/* ── Triggers activés ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <BarChart2 size={14} className="text-[#25D366]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Déclencheurs automatiques</span>
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {TRIGGERS.map((t, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] flex items-center justify-center text-[#25D366] shrink-0">
                {t.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#0F172A]">{t.label}</p>
                <p className="text-[10px] text-[#94A3B8]">{t.desc}</p>
              </div>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: form.actif ? '#25D366' : '#CBD5E1' }} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Error / success ── */}
      {error && (
        <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 text-sm text-[#DC2626]">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {testResult && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
          testResult.ok
            ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A]'
            : 'bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]'
        }`}>
          {testResult.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
          {testResult.msg}
        </div>
      )}

      {/* ── Actions ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={handleTest}
          disabled={testing || !form.phone_number_id}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
          Tester la connexion
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
          style={{ background: saved ? '#16A34A' : '#25D366' }}
        >
          {saving  ? <Loader2 size={14} className="animate-spin" /> :
           saved   ? <Check size={14} /> :
           <Save size={14} />}
          {saved ? 'Enregistré !' : 'Enregistrer'}
        </button>
      </motion.div>
    </div>
  )
}
