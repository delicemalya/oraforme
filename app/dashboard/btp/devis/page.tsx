'use client'

import { useRouter } from 'next/navigation'

export default function BTPDevisPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => router.push('/dashboard/btp')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>←</button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Devis & Appels d'offres</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Rédaction, soumission et suivi des devis BTP</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => router.push('/dashboard/facturation?type=devis')}
          style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
        >
          + Nouveau devis
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Devis BTP & Appels d'offres</div>
        <div style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
          Créez des devis détaillés par lot de travaux, gérez les appels d'offres et convertissez en factures de situation.
          Ce module sera enrichi prochainement.
        </div>
        <button
          onClick={() => router.push('/dashboard/facturation')}
          style={{ marginTop: '24px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
        >
          Aller à la Facturation
        </button>
      </div>
    </div>
  )
}
