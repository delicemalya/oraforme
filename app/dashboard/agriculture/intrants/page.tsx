'use client'

import { useRouter } from 'next/navigation'

export default function AgricultureIntrantsPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => router.push('/dashboard/agriculture')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>←</button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Intrants & Équipements</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Semences, engrais, pesticides et matériel agricole</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => router.push('/dashboard/achats')}
          style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
        >
          Commander des intrants
        </button>
        <button
          onClick={() => router.push('/dashboard/stocks')}
          style={{ background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
        >
          Voir le stock
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌱</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Intrants & Équipements</div>
        <div style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
          Gestion des semences, engrais, produits phytosanitaires et équipements agricoles. Suivi des consommations par parcelle.
          Utilisez le module Stock & Achats pour gérer vos intrants dès maintenant.
        </div>
      </div>
    </div>
  )
}
