'use client'

import { useState } from 'react'
import { Building2, Plus, Phone, Mail, Globe, Users, TrendingUp } from 'lucide-react'

const DEMO_PARTENAIRES = [
  {
    id: '1', nom: 'Pétrogab S.A.', type: 'client_entreprise', secteur: 'Pétrole & Énergie',
    contact: 'Directeur RH', email: 'rh@petrogab.cg', telephone: '+242 06 123 4567',
    placements_actifs: 3, ca_genere: '1 350 000', actif: true,
  },
  {
    id: '2', nom: 'Hôpital Central de Brazzaville', type: 'client_entreprise', secteur: 'Santé',
    contact: 'DAF', email: 'rh@hopital-central.cg', telephone: '+242 06 234 5678',
    placements_actifs: 2, ca_genere: '560 000', actif: true,
  },
  {
    id: '3', nom: 'Université Marien Ngouabi', type: 'source_candidats', secteur: 'Éducation',
    contact: 'Bureau stages', email: 'stages@umng.cg', telephone: '+242 05 345 6789',
    placements_actifs: 0, ca_genere: '0', actif: true,
  },
  {
    id: '4', nom: 'CFAO Motors Congo', type: 'client_entreprise', secteur: 'Automobile',
    contact: 'Responsable RH', email: 'rh@cfao.cg', telephone: '+242 06 456 7890',
    placements_actifs: 1, ca_genere: '420 000', actif: true,
  },
]

const TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  client_entreprise: { label: 'Client entreprise',    color: '#2563EB', bg: '#EFF6FF' },
  source_candidats:  { label: 'Source de candidats',  color: '#7C3AED', bg: '#F5F3FF' },
  partenaire_rh:     { label: 'Partenaire RH',         color: '#16A34A', bg: '#F0FDF4' },
  sous_traitant:     { label: 'Sous-traitant',         color: '#D97706', bg: '#FFFBEB' },
}

export default function PartenairesPage() {
  const [showModal, setShowModal] = useState(false)
  const [filtre, setFiltre] = useState<'tous' | 'client_entreprise' | 'source_candidats'>('tous')

  const filtered = DEMO_PARTENAIRES.filter(p => filtre === 'tous' || p.type === filtre)

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A]">Partenaires</h1>
          <p className="text-[11px] text-[#64748B]">Clients entreprises & sources de candidats</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] shadow-sm"
        >
          <Plus size={14} /> Nouveau partenaire
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Clients actifs',        value: DEMO_PARTENAIRES.filter(p => p.type === 'client_entreprise').length, color: '#2563EB', icon: Building2  },
          { label: 'Sources de candidats',  value: DEMO_PARTENAIRES.filter(p => p.type === 'source_candidats').length,  color: '#7C3AED', icon: Users      },
          { label: 'Placements en cours',   value: DEMO_PARTENAIRES.reduce((s, p) => s + p.placements_actifs, 0),        color: '#16A34A', icon: TrendingUp },
          { label: "CA généré (FCFA)",      value: '2 330 000',                                                            color: '#F59E0B', icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: color + '18' }}>
              <Icon size={15} style={{ color }} />
            </div>
            <p className="text-xl font-extrabold text-[#0F172A]">{value}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'tous', label: 'Tous' },
          { key: 'client_entreprise', label: 'Clients' },
          { key: 'source_candidats', label: 'Sources CV' },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltre(f.key as typeof filtre)}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${filtre === f.key ? 'bg-[#F59E0B] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}
          >{f.label}</button>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(p => {
          const tc = TYPE_CFG[p.type] ?? TYPE_CFG['client_entreprise']
          return (
            <div key={p.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tc.bg }}>
                  <Building2 size={18} style={{ color: tc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#0F172A] truncate">{p.nom}</p>
                  <p className="text-[11px] text-[#64748B]">{p.secteur}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: tc.bg, color: tc.color }}>
                  {tc.label}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-[#64748B] mb-3">
                {p.email && (
                  <div className="flex items-center gap-2"><Mail size={10} className="text-[#94A3B8] shrink-0" /> {p.email}</div>
                )}
                {p.telephone && (
                  <div className="flex items-center gap-2"><Phone size={10} className="text-[#94A3B8] shrink-0" /> {p.telephone}</div>
                )}
                {p.contact && (
                  <div className="flex items-center gap-2"><Users size={10} className="text-[#94A3B8] shrink-0" /> {p.contact}</div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9]">
                <div>
                  <p className="text-[11px] font-bold text-[#0F172A]">{p.placements_actifs} placement{p.placements_actifs !== 1 ? 's' : ''} actif{p.placements_actifs !== 1 ? 's' : ''}</p>
                  {parseInt(p.ca_genere.replace(' ', '')) > 0 && (
                    <p className="text-[10px] text-[#16A34A] font-semibold">{p.ca_genere} FCFA générés</p>
                  )}
                </div>
                <div className={`w-2 h-2 rounded-full ${p.actif ? 'bg-green-400' : 'bg-gray-300'}`} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal simplifié */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-[16px] font-bold text-[#0F172A]">Nouveau partenaire</h2>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Nom de l&apos;entreprise</label>
              <input placeholder="Ex. : Total Congo S.A." className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Type</label>
              <select className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 bg-white">
                <option value="client_entreprise">Client entreprise</option>
                <option value="source_candidats">Source de candidats</option>
                <option value="partenaire_rh">Partenaire RH</option>
                <option value="sous_traitant">Sous-traitant</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 text-[13px] font-semibold text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">Annuler</button>
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706]">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
