'use client'

import { useRouter } from 'next/navigation'

export default function BanqueOperationsPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => router.push('/dashboard/banque')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>←</button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Opérations & Transactions</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Virements, dépôts, retraits et mouvements de fonds</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => router.push('/dashboard/tresorerie')}
          style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
        >
          Voir toutes les transactions
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>↔️</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Opérations Microfinance</div>
        <div style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
          Gestion des opérations journalières : dépôts, retraits, virements entre comptes membres, mobile money et états de caisse.
          Utilisez la Trésorerie pour enregistrer vos opérations dès maintenant.
        </div>
        <button
          onClick={() => router.push('/dashboard/tresorerie')}
          style={{ marginTop: '24px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
        >
          Aller à la Trésorerie
        </button>
      </div>
    </div>
  )
}
