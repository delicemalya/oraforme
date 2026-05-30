'use client'

import { useRouter } from 'next/navigation'

export default function BanqueCreditsPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => router.push('/dashboard/banque')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>←</button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Crédits & Prêts</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Octroi, suivi et remboursement des crédits</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Crédits actifs',     value: '—', color: '#2563EB' },
          { label: 'Montant décaissé',   value: '—', color: '#DC2626' },
          { label: 'En souffrance',      value: '—', color: '#F59E0B' },
          { label: 'Remboursé ce mois',  value: '—', color: '#16A34A' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Gestion des Crédits</div>
        <div style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
          Demande de crédit, analyse de solvabilité, tableau d'amortissement, suivi des échéances et relances.
          Module en cours de développement.
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
          <button
            onClick={() => router.push('/dashboard/tresorerie')}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
          >
            Voir la Trésorerie
          </button>
          <button
            onClick={() => router.push('/dashboard/facturation')}
            style={{ background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
          >
            Créer un document
          </button>
        </div>
      </div>
    </div>
  )
}
