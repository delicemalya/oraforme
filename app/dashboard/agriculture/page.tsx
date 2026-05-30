'use client'

import { useRouter } from 'next/navigation'

export default function AgricultureDashboardPage() {
  const router = useRouter()

  const stats = [
    { label: 'Parcelles actives',  value: '—', color: '#16A34A' },
    { label: 'Récoltes ce mois',   value: '—', color: '#F59E0B' },
    { label: 'Stock intrants',     value: '—', color: '#2563EB' },
    { label: 'CA saison',         value: '—', color: '#DC2626' },
  ]

  const shortcuts = [
    { label: 'Parcelles & Cultures',    href: '/dashboard/agriculture/parcelles', icon: '🌾' },
    { label: 'Récoltes & Production',   href: '/dashboard/agriculture/recoltes',  icon: '🌽' },
    { label: 'Intrants & Outils',       href: '/dashboard/agriculture/intrants',  icon: '🌱' },
    { label: 'Stocks',                  href: '/dashboard/stocks',                icon: '📦' },
    { label: 'Achats Fournisseurs',     href: '/dashboard/achats',                icon: '🛒' },
    { label: 'Facturation Clients',     href: '/dashboard/facturation',           icon: '💰' },
  ]

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Agriculture & Exploitation</h1>
        <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Gestion des parcelles, récoltes et intrants agricoles</p>
      </div>

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
    </div>
  )
}
