'use client'

import { useRouter } from 'next/navigation'

export default function BTPChantiersPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => router.push('/dashboard/btp')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>←</button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Chantiers & Projets</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Suivi d'avancement, planification et budget</p>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏗️</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Module Chantiers</div>
        <div style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
          Suivi des chantiers BTP, planning Gantt, avancement par lot et gestion budgétaire.
          Ce module sera disponible prochainement.
        </div>
        <button
          onClick={() => router.push('/dashboard/facturation')}
          style={{ marginTop: '24px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
        >
          Créer une facture de chantier
        </button>
      </div>
    </div>
  )
}
