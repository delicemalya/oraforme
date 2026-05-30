'use client'

import { useRouter } from 'next/navigation'

export default function BanqueClientsPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => router.push('/dashboard/banque')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>←</button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Membres & Comptes</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>Gestion des membres et de leurs comptes</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => router.push('/dashboard/crm')}
          style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
        >
          + Nouveau membre
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Membres & Comptes</div>
        <div style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
          Gestion des membres de la microfinance, ouverture de comptes, KYC et historique des transactions.
          Module en cours de développement — utilisez le CRM pour gérer les membres dès maintenant.
        </div>
        <button
          onClick={() => router.push('/dashboard/crm')}
          style={{ marginTop: '24px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
        >
          Aller au CRM
        </button>
      </div>
    </div>
  )
}
