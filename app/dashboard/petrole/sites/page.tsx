'use client'

import { useRouter } from 'next/navigation'

export default function PetroleSitesPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => router.push('/dashboard/petrole')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>←</button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Sites & Puits d'extraction</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Gestion des sites pétroliers et miniers, production journalière</p>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛢️</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Sites Pétroliers & Miniers</div>
        <div style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
          Enregistrement des sites d'extraction, suivi de la production journalière, gestion des équipes de terrain et rapports de production.
          Module en cours de développement.
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
          <button
            onClick={() => router.push('/dashboard/stocks')}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
          >
            Gérer les stocks
          </button>
        </div>
      </div>
    </div>
  )
}
