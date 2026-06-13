'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { MessageCircle, ChevronRight, CheckCircle2, AlertCircle, Settings2, Database, ScanLine } from 'lucide-react'
import { useTenant } from '@/lib/hooks/useTenant'

interface IntegrationCard {
  id:          string
  name:        string
  description: string
  icon:        React.ReactNode
  href:        string
  color:       string
  bgColor:     string
  status:      'active' | 'inactive' | 'partial'
}

function StatusBadge({ status }: { status: 'active' | 'inactive' | 'partial' }) {
  if (status === 'active')
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
        <CheckCircle2 size={11} /> Actif
      </span>
    )
  if (status === 'partial')
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-[#D97706]">
        <AlertCircle size={11} /> Partiel
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#94A3B8]">
      <Settings2 size={11} /> Non configuré
    </span>
  )
}

export default function IntegrationsPage() {
  const { tenantId } = useTenant()
  const [waStatus,      setWaStatus]      = useState<'active' | 'inactive' | 'partial'>('inactive')
  const [storageStatus, setStorageStatus] = useState<'active' | 'inactive' | 'partial'>('inactive')
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!tenantId) return
    Promise.all([
      fetch('/api/whatsapp/config').then(r => r.json()).catch(() => ({})),
      fetch('/api/storage/config').then(r => r.json()).catch(() => ({})),
    ]).then(([wa, st]) => {
      const waCfg = wa.config
      if (!waCfg) setWaStatus('inactive')
      else if (waCfg.actif && waCfg.phone_number_id && waCfg.access_token) setWaStatus('active')
      else setWaStatus('partial')

      const stCfg = st.config
      if (!stCfg) setStorageStatus('inactive')
      else if (stCfg.s3_endpoint && stCfg.s3_bucket && stCfg.s3_access_key) setStorageStatus('active')
      else setStorageStatus('partial')
    }).finally(() => setLoading(false))
  }, [tenantId])

  const integrations: IntegrationCard[] = [
    {
      id:          'whatsapp',
      name:        'WhatsApp Business',
      description: 'Envoi automatique de factures, bulletins de paie, rappels et alertes fiscales via WhatsApp Business Cloud API (Meta).',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
      href:    '/dashboard/parametres/integrations/whatsapp',
      color:   '#25D366',
      bgColor: '#F0FDF4',
      status:  loading ? 'inactive' : waStatus,
    },
    {
      id:          'storage',
      name:        'Stockage Cloud',
      description: 'Stockage sécurisé des documents (CV, contrats, factures, bulletins) sur AWS S3, Cloudflare R2, Wasabi ou MinIO. Versioning, archivage et audit trail inclus.',
      icon:        <Database className="w-6 h-6" />,
      href:        '/dashboard/parametres/stockage',
      color:       '#2563EB',
      bgColor:     '#EFF6FF',
      status:      loading ? 'inactive' : storageStatus,
    },
    {
      id:          'ocr',
      name:        'OCR Intelligent',
      description: 'Extraction automatique du texte et des données structurées depuis vos documents scannés via Mistral Pixtral, Claude Vision ou Tesseract. Détection auto du type de document.',
      icon:        <ScanLine className="w-6 h-6" />,
      href:        '/dashboard/parametres/stockage',
      color:       '#7C3AED',
      bgColor:     '#F5F3FF',
      status:      loading ? 'inactive' : storageStatus,
    },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[#0F172A]">Intégrations</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Connectez Oraforme à des services externes : notifications, stockage cloud et OCR intelligent.
        </p>
      </div>

      <div className="grid gap-4">
        {integrations.map((intg, i) => (
          <motion.div
            key={intg.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Link
              href={intg.href}
              className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-md transition-all group"
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                style={{ background: intg.bgColor, color: intg.color }}
              >
                {intg.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-[#0F172A]">{intg.name}</span>
                  <StatusBadge status={intg.status} />
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2">
                  {intg.description}
                </p>
              </div>

              <ChevronRight size={18} className="text-[#CBD5E1] group-hover:text-[#94A3B8] shrink-0 transition-colors" />
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-xs text-[#CBD5E1] mt-8">
        D&apos;autres intégrations arrivent bientôt — Email SMTP, Slack, Telegram…
      </p>
    </div>
  )
}
