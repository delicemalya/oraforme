'use client'

import { useState } from 'react'
import { UserCheck, Plus, Briefcase, Clock, TrendingUp } from 'lucide-react'

const DEMO_PLACEMENTS = [
  {
    id: '1', candidat: 'Alain Nkounkou', entreprise: 'Pétrogab S.A.',
    poste: 'Comptable Senior', type: 'CDI', date_debut: '2026-06-01',
    salaire: '350 000', statut: 'actif', commission: '52 500',
  },
  {
    id: '2', candidat: 'Marie Oba', entreprise: 'Hôpital Central',
    poste: 'Infirmière chef', type: 'CDD', date_debut: '2026-05-15',
    salaire: '280 000', statut: 'actif', commission: '28 000',
  },
  {
    id: '3', candidat: 'Paul Moukagni', entreprise: 'CFAO Motors',
    poste: 'Responsable RH', type: 'CDI', date_debut: '2026-04-01',
    salaire: '420 000', statut: 'essai', commission: '63 000',
  },
  {
    id: '4', candidat: 'Sylvie Ikama', entreprise: 'SNE Congo',
    poste: 'Technicienne réseau', type: 'intérim', date_debut: '2026-03-10',
    salaire: '190 000', statut: 'termine', commission: '19 000',
  },
]

const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  actif:    { label: 'Actif',            color: '#16A34A', bg: '#F0FDF4' },
  essai:    { label: "Période d'essai",  color: '#D97706', bg: '#FFFBEB' },
  termine:  { label: 'Terminé',          color: '#475569', bg: '#F1F5F9' },
}

export default function PlacementPage() {
  const [filtre, setFiltre] = useState<'tous' | 'actif' | 'essai' | 'termine'>('actif')

  const filtered = DEMO_PLACEMENTS.filter(p => filtre === 'tous' || p.statut === filtre)
  const totalCommissions = filtered.filter(p => p.statut !== 'termine')
    .reduce((s, p) => s + parseInt(p.commission.replace(' ', '')), 0)

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A]">Placements</h1>
          <p className="text-[11px] text-[#64748B]">Missions & contrats placés</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] shadow-sm"
        >
          <Plus size={14} /> Nouveau placement
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Placements actifs', value: DEMO_PLACEMENTS.filter(p => p.statut === 'actif').length, color: '#16A34A', icon: UserCheck },
          { label: "En période d'essai", value: DEMO_PLACEMENTS.filter(p => p.statut === 'essai').length, color: '#D97706', icon: Clock },
          { label: 'Total placements', value: DEMO_PLACEMENTS.length, color: '#2563EB', icon: Briefcase },
          { label: 'Commissions actives (FCFA)', value: `${totalCommissions.toLocaleString('fr-FR')}`, color: '#16A34A', icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: color + '18' }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-xl font-extrabold text-[#0F172A]">{value}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {[
          { key: 'actif', label: 'Actifs' },
          { key: 'essai', label: 'En essai' },
          { key: 'termine', label: 'Terminés' },
          { key: 'tous', label: 'Tous' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltre(f.key as typeof filtre)}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${filtre === f.key ? 'bg-[#F59E0B] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {filtered.map(p => {
          const sc = STATUT_CFG[p.statut] ?? STATUT_CFG['actif']
          return (
            <div key={p.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center shrink-0">
                  <UserCheck size={18} className="text-[#16A34A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-[13px] font-bold text-[#0F172A]">{p.candidat}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                      {sc.label}
                    </span>
                    <span className="text-[10px] bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-full font-semibold">{p.type}</span>
                  </div>
                  <p className="text-[12px] font-semibold text-[#374151]">{p.poste} — {p.entreprise}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-[#94A3B8]">
                    <span>Depuis {new Date(p.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span className="text-[#0F172A] font-semibold">{p.salaire} FCFA / mois</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-[#94A3B8]">Commission</p>
                  <p className="text-[13px] font-bold text-[#16A34A]">{p.commission} FCFA</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-[#FEF3C7]/50 border border-[#F59E0B]/20 rounded-xl p-4 text-center">
        <p className="text-[12px] text-[#92400E] font-medium">
          Ces données sont des exemples. Connectez votre CRM ou importez vos placements pour les voir ici.
        </p>
      </div>
    </div>
  )
}
