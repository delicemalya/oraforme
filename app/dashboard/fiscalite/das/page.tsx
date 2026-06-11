'use client'

/**
 * DAS — Déclaration des Sommes versées à des Tiers
 * Congo-Brazzaville · DGI · Obligation annuelle avant le 31 mars N+1
 * Concerne : honoraires, commissions, loyers, jetons de présence versés à des tiers
 * Seuil de déclaration : ≥ 100 000 FCFA par an et par bénéficiaire
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  FileText, Download, Plus, X, CheckCircle2, Info, Trash2, Search,
} from 'lucide-react'

const SEUIL_DECLARATION = 100_000

type TypeSomme =
  | 'honoraires'
  | 'commissions'
  | 'loyers'
  | 'jetons_presence'
  | 'royalties'
  | 'remuneration_gerant'
  | 'autres'

const TYPE_LABELS: Record<TypeSomme, string> = {
  honoraires:          'Honoraires professionnels',
  commissions:         'Commissions & courtages',
  loyers:              'Loyers & charges locatives',
  jetons_presence:     'Jetons de présence',
  royalties:           'Redevances & royalties',
  remuneration_gerant: 'Rémunération de gérant',
  autres:              'Autres sommes',
}

const TYPE_COMPTES: Record<TypeSomme, string> = {
  honoraires:          '623 — Honoraires',
  commissions:         '627 — Publicité, comm., relations pub.',
  loyers:              '622 — Locations et charges locatives',
  jetons_presence:     '663 — Jetons de présence',
  royalties:           '622 — Redevances pour brevets',
  remuneration_gerant: '661 — Rémunérations directes',
  autres:              '658 — Charges diverses',
}

interface BeneficiaireDAS {
  id:           string
  annee:        number
  nom:          string
  prenom?:      string
  nif?:         string
  adresse?:     string
  type_somme:   TypeSomme
  montant:      number
  retenue_a_la_source?: number
  statut:       'brouillon' | 'declare' | 'valide'
  notes?:       string
  created_at:   string
}

const ANNEES = [2023, 2024, 2025, 2026]

export default function DASPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const [annee,        setAnnee]       = useState(new Date().getFullYear())
  const [beneficiaires,setBenef]       = useState<BeneficiaireDAS[]>([])
  const [loading,      setLoading]     = useState(true)
  const [showModal,    setShowModal]   = useState(false)
  const [saving,       setSaving]      = useState(false)
  const [saveOk,       setSaveOk]      = useState(false)
  const [search,       setSearch]      = useState('')

  /* Form */
  const [fNom,     setFNom]     = useState('')
  const [fPrenom,  setFPrenom]  = useState('')
  const [fNif,     setFNif]     = useState('')
  const [fAdresse, setFAdresse] = useState('')
  const [fType,    setFType]    = useState<TypeSomme>('honoraires')
  const [fMontant, setFMontant] = useState('')
  const [fRetenue, setFRetenue] = useState('')
  const [fNotes,   setFNotes]   = useState('')
  const [saveErr,  setSaveErr]  = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('das_beneficiaires')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('annee', annee)
      .order('created_at', { ascending: false })
    setBenef((data ?? []) as BeneficiaireDAS[])
    setLoading(false)
  }, [tenantId, annee])

  useEffect(() => { void load() }, [load])

  /* Filtrage */
  const filtered = beneficiaires.filter(b =>
    b.nom.toLowerCase().includes(search.toLowerCase()) ||
    (b.prenom ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (b.nif ?? '').toLowerCase().includes(search.toLowerCase())
  )

  /* Stats */
  const total           = filtered.reduce((s, b) => s + b.montant, 0)
  const totalRetenue    = filtered.reduce((s, b) => s + (b.retenue_a_la_source ?? 0), 0)
  const nbDeclarable    = filtered.filter(b => b.montant >= SEUIL_DECLARATION).length
  const nbDeclare       = filtered.filter(b => b.statut === 'declare' || b.statut === 'valide').length

  async function save() {
    if (!tenantId) return
    if (!fNom.trim() || !fMontant) { setSaveErr('Nom et montant obligatoires'); return }
    setSaving(true); setSaveErr(null)
    const { error } = await supabase.from('das_beneficiaires').insert({
      tenant_id: tenantId, annee,
      nom: fNom.trim(), prenom: fPrenom || null,
      nif: fNif || null, adresse: fAdresse || null,
      type_somme: fType,
      montant: Number(fMontant),
      retenue_a_la_source: fRetenue ? Number(fRetenue) : null,
      statut: 'brouillon',
      notes: fNotes || null,
    })
    if (error) { setSaveErr(error.message); setSaving(false); return }
    setSaveOk(true)
    setTimeout(() => { setSaveOk(false); setShowModal(false); resetForm(); void load() }, 1000)
    setSaving(false)
  }

  async function supprimer(id: string) {
    await supabase.from('das_beneficiaires').delete().eq('id', id)
    void load()
  }

  async function marquerDeclare(id: string) {
    await supabase.from('das_beneficiaires').update({ statut: 'declare' }).eq('id', id)
    void load()
  }

  function resetForm() {
    setFNom(''); setFPrenom(''); setFNif(''); setFAdresse('')
    setFType('honoraires'); setFMontant(''); setFRetenue(''); setFNotes('')
    setSaveErr(null); setSaveOk(false)
  }

  function exportCSV() {
    const header = ['Nom','Prénom','NIF','Adresse','Type','Compte SYSCOHADA','Montant','Retenue','Statut']
    const rows = filtered.map(b => [
      b.nom, b.prenom ?? '', b.nif ?? '', b.adresse ?? '',
      TYPE_LABELS[b.type_somme], TYPE_COMPTES[b.type_somme],
      b.montant, b.retenue_a_la_source ?? 0, b.statut,
    ])
    const csv = '﻿' + [header, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `DAS-${annee}.csv`; a.click()
  }

  function StatutBadge({ s }: { s: string }) {
    if (s === 'valide')   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#16A34A]">Validé DGI</span>
    if (s === 'declare')  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB]">Déclaré</span>
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#D97706]">Brouillon</span>
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#059669] border-t-transparent rounded-full animate-spin mr-2" />
      Chargement DAS...
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <FileText size={22} className="text-[#059669]" />
            Déclaration des Sommes versées à des Tiers (DAS)
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Congo-Brazzaville · DGI · Dépôt avant le 31 mars {annee + 1} · Seuil {fmtFCFA(SEUIL_DECLARATION)}/bénéficiaire
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {ANNEES.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#059669] text-white rounded-lg text-[12px] font-bold hover:bg-[#047857]">
            <Plus size={13} /> Bénéficiaire
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total versé',          value: fmtFCFA(total),        color: '#0F172A' },
          { label: 'Retenues à la source', value: fmtFCFA(totalRetenue), color: '#DC2626' },
          { label: 'À déclarer (≥ seuil)', value: String(nbDeclarable),  color: '#D97706' },
          { label: 'Déclarés / validés',   value: String(nbDeclare),     color: '#16A34A' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1">{k.label}</p>
            <p className="text-[18px] font-extrabold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, prénom ou NIF..."
          className="w-full border border-[#E2E8F0] rounded-lg pl-8 pr-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
        />
      </div>

      {/* Tableau bénéficiaires */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#0F172A]">Bénéficiaires {annee}</p>
          <span className="text-[11px] text-[#94A3B8]">{filtered.length} enregistrement(s)</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-[#94A3B8]">
            <FileText size={32} className="opacity-30" />
            <p className="text-[12px]">Aucun bénéficiaire pour {annee}</p>
            <button onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 bg-[#059669] text-white rounded-lg text-[12px] font-bold hover:bg-[#047857]">
              + Ajouter un bénéficiaire
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {['Bénéficiaire','NIF','Type','Compte SYSCOHADA','Montant','Retenue','Statut','Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#94A3B8] uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-[#0F172A]">{b.nom}{b.prenom ? ` ${b.prenom}` : ''}</p>
                      {b.adresse && <p className="text-[10px] text-[#94A3B8] truncate max-w-[160px]">{b.adresse}</p>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[#64748B]">{b.nif || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#059669] font-semibold text-[10px] whitespace-nowrap">
                        {TYPE_LABELS[b.type_somme]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[#64748B] text-[10px] whitespace-nowrap">{TYPE_COMPTES[b.type_somme]}</td>
                    <td className="px-4 py-2.5 font-bold text-[#0F172A]">
                      {fmtFCFA(b.montant)}
                      {b.montant < SEUIL_DECLARATION && (
                        <span className="ml-1 text-[9px] text-[#94A3B8]">(sous seuil)</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[#DC2626] font-semibold">
                      {b.retenue_a_la_source ? fmtFCFA(b.retenue_a_la_source) : '—'}
                    </td>
                    <td className="px-4 py-2.5"><StatutBadge s={b.statut} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {b.statut === 'brouillon' && (
                          <button
                            onClick={() => void marquerDeclare(b.id)}
                            className="px-2 py-1 bg-[#EFF6FF] text-[#2563EB] rounded text-[10px] font-bold hover:bg-[#DBEAFE] whitespace-nowrap"
                          >
                            ✓ Déclarer
                          </button>
                        )}
                        <button
                          onClick={() => void supprimer(b.id)}
                          className="p-1 text-[#94A3B8] hover:text-[#DC2626] rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F8FAFC] border-t border-[#E2E8F0]">
                  <td colSpan={4} className="px-4 py-2.5 font-bold text-[11px] text-[#0F172A]">TOTAL</td>
                  <td className="px-4 py-2.5 font-extrabold text-[#0F172A]">{fmtFCFA(total)}</td>
                  <td className="px-4 py-2.5 font-extrabold text-[#DC2626]">{fmtFCFA(totalRetenue)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Note légale */}
      <div className="rounded-xl border border-[#E2E8F0] p-4 bg-[#F8FAFC]">
        <div className="flex items-start gap-2">
          <Info size={13} className="text-[#059669] shrink-0 mt-0.5" />
          <div className="text-[11px] text-[#64748B] space-y-1 leading-relaxed">
            <p><strong className="text-[#0F172A]">Obligation DAS (CGI Congo)</strong> : Toute entreprise doit déclarer les sommes versées à des tiers (personnes physiques hors salariés) supérieures à {fmtFCFA(SEUIL_DECLARATION)} par an.</p>
            <p><strong className="text-[#0F172A]">Délai</strong> : Dépôt à la DGI avant le 31 mars de l&apos;année suivant le versement.</p>
            <p><strong className="text-[#0F172A]">Sanctions</strong> : Amende de 10% des sommes non déclarées + régularisation de la retenue à la source éludée.</p>
            <p><strong className="text-[#0F172A]">Comptes SYSCOHADA concernés</strong> : 622 Loyers · 623 Honoraires · 627 Commissions · 661 Rémunérations gérant · 663 Jetons de présence.</p>
            <p><strong className="text-[#0F172A]">Retenue à la source</strong> : Peut être exigée sur certaines sommes (honoraires → 15%, loyers → 5%) selon profil du bénéficiaire.</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[#0F172A] text-[15px]">Nouveau bénéficiaire DAS {annee}</h2>
              <button onClick={() => { setShowModal(false); resetForm() }}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Nom *</label>
                  <input value={fNom} onChange={e => setFNom(e.target.value)}
                    placeholder="MBEMBA"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Prénom</label>
                  <input value={fPrenom} onChange={e => setFPrenom(e.target.value)}
                    placeholder="Jean-Paul"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">NIF (si applicable)</label>
                  <input value={fNif} onChange={e => setFNif(e.target.value)}
                    placeholder="M-12345678A"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Adresse</label>
                  <input value={fAdresse} onChange={e => setFAdresse(e.target.value)}
                    placeholder="Brazzaville, Congo"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Type de somme *</label>
                <select value={fType} onChange={e => setFType(e.target.value as TypeSomme)}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#059669]/30">
                  {(Object.entries(TYPE_LABELS) as [TypeSomme, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[#94A3B8] mt-1">Compte SYSCOHADA : {TYPE_COMPTES[fType]}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Montant brut versé (FCFA) *</label>
                  <input type="number" value={fMontant} onChange={e => setFMontant(e.target.value)}
                    placeholder="0"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Retenue à la source (FCFA)</label>
                  <input type="number" value={fRetenue} onChange={e => setFRetenue(e.target.value)}
                    placeholder="0"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
              </div>

              {fMontant && Number(fMontant) < SEUIL_DECLARATION && (
                <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2 text-[11px] text-[#D97706]">
                  ⚠ Montant inférieur au seuil de déclaration ({fmtFCFA(SEUIL_DECLARATION)}) — non obligatoire mais possible.
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Notes</label>
                <input value={fNotes} onChange={e => setFNotes(e.target.value)}
                  placeholder="Nature des prestations..."
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
              </div>

              {saveErr && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{saveErr}</p>}
              {saveOk  && (
                <p className="text-[12px] text-[#16A34A] bg-[#DCFCE7] px-3 py-2 rounded-lg flex items-center gap-1">
                  <CheckCircle2 size={13} /> Bénéficiaire ajouté !
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => void save()} disabled={saving}
                  className="flex-1 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Enregistrer
                </button>
                <button onClick={() => { setShowModal(false); resetForm() }}
                  className="px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-[12px] text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
