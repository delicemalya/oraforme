'use client'

import { useRouter } from 'next/navigation'

export default function BanqueEpargnePage() {
  const router = useRouter()

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => router.push('/dashboard/banque')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>←</button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Épargne & Dépôts</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Comptes d'épargne, dépôts et retraits</p>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏦</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Épargne & Dépôts</div>
        <div style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
          Ouverture de livrets d'épargne, dépôts à terme, calcul des intérêts et suivi des soldes par membre.
          Module en cours de développement.
        </div>
        <button
          onClick={() => router.push('/dashboard/tresorerie')}
          style={{ marginTop: '24px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
        >
          Voir la Trésorerie
        </button>
      </div>
    </div>
  )
}
