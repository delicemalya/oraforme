'use client'
import { useFmt } from '@/lib/hooks/useFmt'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface KPI {
  chantiers_actifs: number
  chantiers_termines: number
  ca_mois: number
  devis_en_attente: number
}

export default function BTPDashboardPage() {
  const { fmt: fmtFCFA } = useFmt()
  const router = useRouter()
  const [kpi, setKpi] = useState<KPI>({ chantiers_actifs: 0, chantiers_termines: 0, ca_mois: 0, devis_en_attente: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // Placeholder: real KPIs will come from API once btp_chantiers table is created
        setKpi({ chantiers_actifs: 0, chantiers_termines: 0, ca_mois: 0, devis_en_attente: 0 })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = [
    { label: 'Chantiers actifs',   value: kpi.chantiers_actifs.toString(),  color: '#2563EB' },
    { label: 'Chantiers terminés', value: kpi.chantiers_termines.toString(), color: '#16A34A' },
    { label: 'CA du mois',         value: fmtFCFA(kpi.ca_mois),             color: '#F59E0B' },
    { label: 'Devis en attente',   value: kpi.devis_en_attente.toString(),  color: '#DC2626' },
  ]

  const shortcuts = [
    { label: 'Devis & Appels d\'offres', href: '/dashboard/btp/devis',     icon: '📋' },
    { label: 'Chantiers',               href: '/dashboard/btp/chantiers',  icon: '🏗️' },
    { label: 'Matériaux & Équipements', href: '/dashboard/btp/materiaux',  icon: '🧱' },
    { label: 'Facturation',             href: '/dashboard/facturation',    icon: '💰' },
    { label: 'Achats Fournisseurs',     href: '/dashboard/achats',         icon: '🛒' },
    { label: 'RH & Équipes',           href: '/dashboard/rh',             icon: '👷' },
  ]

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>BTP & Construction</h1>
        <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Gestion des chantiers, matériaux et équipes</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Accès rapides</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {shortcuts.map(s => (
              <button
                key={s.href}
                onClick={() => router.push(s.href)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, textAlign: 'left' }}
              >
                <span style={{ fontSize: '20px' }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
