'use client'

/**
 * Avantages RH — Employee benefits management
 * Transport, logement, téléphone, repas, assurance, formation, prime
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { Gift, Plus, X, Trash2, Users, DollarSign } from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────── */
interface Employe { id: string; nom: string; poste: string; departement: string | null }

interface Avantage {
  id: string
  tenant_id: string
  employe_id: string | null
  type: string
  libelle: string
  montant: number | null
  periodicite: string
  statut: string
  date_debut: string | null
  date_fin: string | null
  employes?: { nom: string; poste: string } | null
  created_at: string
}

/* ─── Config ─────────────────────────────────────────────── */
const TYPES = [
  { value: 'transport',  label: 'Transport',           icon: '🚗', color: '#2563EB' },
  { value: 'logement',   label: 'Logement',            icon: '🏠', color: '#16A34A' },
  { value: 'telephone',  label: 'Téléphone',           icon: '📱', color: '#8B5CF6' },
  { value: 'repas',      label: 'Repas / Tickets',     icon: '🍽️', color: '#D97706' },
  { value: 'assurance',  label: 'Assurance',           icon: '🛡️', color: '#0891B2' },
  { value: 'formation',  label: 'Formation',           icon: '📚', color: '#F59E0B' },
  { value: 'prime',      label: 'Prime exceptionnelle',icon: '⭐', color: '#DC2626' },
  { value: 'voiture',    label: 'Voiture de fonction', icon: '🚙', color: '#64748B' },
  { value: 'autre',      label: 'Autre',               icon: '🎁', color: '#94A3B8' },
]

const PERIODICITES = [
  { value: 'mensuel',    label: 'Mensuel'    },
  { value: 'trimestriel',label: 'Trimestriel'},
  { value: 'annuel',     label: 'Annuel'     },
  { value: 'ponctuel',   label: 'Ponctuel'   },
]

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const EMPTY_FORM = {
  employe_id:   '',   // '' = tous / global
  type:         'transport',
  libelle:      '',
  montant:      '',
  periodicite:  'mensuel',
  statut:       'actif',
  date_debut:   new Date().toISOString().slice(0, 10),
  date_fin:     '',
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function AvantagesPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t } = useLocale()
  const [avantages, setAvantages] = useState<Avantage[]>([])
  const [employes, setEmployes]   = useState<Employe[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [filterType, setFilterType] = useState('all')

  /* Load */
  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [avR, empR] = await Promise.all([
        supabase
          .from('avantages')
          .select('*, employes(nom, poste)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        supabase
          .from('employes')
          .select('id, nom, poste, departement')
          .eq('tenant_id', tenantId)
          .eq('statut', 'actif')
          .order('nom'),
      ])
      if (avR.error?.code !== '42P01') setAvantages(avR.data || [])
      setEmployes(empR.data || [])
      setLoading(false)
    })()
  }, [tenantId])

  async function handleSave() {
    if (!tenantId || !form.libelle.trim()) {
      setError('Libellé obligatoire')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('avantages').insert({
      tenant_id:   tenantId,
      employe_id:  form.employe_id || null,
      type:        form.type,
      libelle:     form.libelle.trim(),
      montant:     form.montant ? Number(form.montant) : null,
      periodicite: form.periodicite,
      statut:      form.statut,
      date_debut:  form.date_debut || null,
      date_fin:    form.date_fin   || null,
    })
    if (err) { setError(err.message); setSaving(false); return }
    const { data } = await supabase
      .from('avantages').select('*, employes(nom, poste)')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setAvantages(data || [])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet avantage ?')) return
    await supabase.from('avantages').delete().eq('id', id).eq('tenant_id', tenantId)
    setAvantages(prev => prev.filter(a => a.id !== id))
  }

  async function handleToggleStatut(id: string, current: string) {
    const next = current === 'actif' ? 'inactif' : 'actif'
    await supabase.from('avantages').update({ statut: next }).eq('id', id).eq('tenant_id', tenantId)
    setAvantages(prev => prev.map(a => a.id === id ? { ...a, statut: next } : a))
  }

  const filtered = filterType === 'all' ? avantages : avantages.filter(a => a.type === filterType)

  /* KPIs */
  const totalActifs    = avantages.filter(a => a.statut === 'actif').length
  const totalMontant   = avantages
    .filter(a => a.statut === 'actif' && a.periodicite === 'mensuel' && a.montant)
    .reduce((s, a) => s + (a.montant ?? 0), 0)
  const beneficiaires  = new Set(avantages.filter(a => a.employe_id).map(a => a.employe_id)).size
  const globaux        = avantages.filter(a => !a.employe_id).length

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#94A3B8]">
        <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <Gift size={22} className="text-[#F59E0B]" />
            {t('rh.avantages.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">{t('rh.avantages.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12px] font-bold rounded-lg shadow-sm"
        >
          <Plus size={14} />
          {t('rh.avantages.new')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('rh.avantages.colStatut'), value: totalActifs.toString(),         color: '#F59E0B', icon: Gift     },
          { label: t('rh.avantages.colMontant'), value: totalMontant > 0 ? fmtFCFA(totalMontant) : '—', color: '#16A34A', icon: DollarSign },
          { label: t('rh.avantages.colBeneficiaires'), value: beneficiaires.toString(),       color: '#2563EB', icon: Users    },
          { label: t('rh.avantages.title'), value: globaux.toString(),             color: '#8B5CF6', icon: Gift     },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: k.color + '18' }}>
              <k.icon size={16} style={{ color: k.color }} />
            </div>
            <div>
              <div className="text-[18px] font-extrabold text-[#0F172A]">{k.value}</div>
              <div className="text-[10px] text-[#64748B]">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[#0F172A] text-[15px]">{t('rh.avantages.new')}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">

              {/* Employé (optionnel) */}
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
                  Employé <span className="font-normal text-[#94A3B8]">(laisser vide = avantage global pour tous)</span>
                </label>
                <select
                  value={form.employe_id}
                  onChange={e => setForm(f => ({ ...f, employe_id: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                >
                  <option value="">— Tous les employés (global) —</option>
                  {employes.map(e => (
                    <option key={e.id} value={e.id}>{e.nom} — {e.poste}</option>
                  ))}
                </select>
              </div>

              {/* Type + Périodicité */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Type *</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  >
                    {TYPES.map(typ => <option key={typ.value} value={typ.value}>{typ.icon} {typ.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Périodicité</label>
                  <select
                    value={form.periodicite}
                    onChange={e => setForm(f => ({ ...f, periodicite: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  >
                    {PERIODICITES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Libellé + Montant */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Libellé *</label>
                  <input
                    value={form.libelle}
                    onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                    placeholder="ex: Indemnité transport"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Montant (FCFA)</label>
                  <input
                    type="number"
                    value={form.montant}
                    onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date de début</label>
                  <input type="date" value={form.date_debut}
                    onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date de fin</label>
                  <input type="date" value={form.date_fin}
                    onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
                </div>
              </div>

              {error && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Enregistrer
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-[12px] text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl border border-[#E2E8F0] p-1">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filterType === 'all' ? 'bg-[#F59E0B] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
        >
          Tous ({avantages.length})
        </button>
        {TYPES.map(typ => {
          const cnt = avantages.filter(a => a.type === typ.value).length
          if (cnt === 0) return null
          return (
            <button
              key={typ.value}
              onClick={() => setFilterType(typ.value)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
                filterType === typ.value ? 'text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
              style={filterType === typ.value ? { background: typ.color } : {}}
            >
              {typ.icon} {typ.label} ({cnt})
            </button>
          )
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-20 text-center">
          <Gift size={36} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[14px] font-semibold text-[#64748B]">{t('rh.avantages.empty')}</p>
          <p className="text-[12px] text-[#94A3B8] mt-1">{t('rh.avantages.new')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(a => {
            const typeConf = TYPES.find(typ => typ.value === a.type) || { icon: '🎁', color: '#94A3B8', label: a.type }
            const isActif = a.statut === 'actif'
            return (
              <div
                key={a.id}
                className={`bg-white rounded-xl border overflow-hidden transition-all hover:shadow-sm ${
                  isActif ? 'border-[#E2E8F0]' : 'border-dashed border-[#E2E8F0] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: typeConf.color + '18' }}
                  >
                    {typeConf.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-[#0F172A]">{a.libelle}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        isActif ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F1F5F9] text-[#94A3B8]'
                      }`}>
                        {isActif ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {a.employes ? a.employes.nom : <span className="text-[#2563EB]">Global — tous les employés</span>}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {a.montant && (
                        <span className="text-[12px] font-bold" style={{ color: typeConf.color }}>
                          {fmtFCFA(a.montant)}
                        </span>
                      )}
                      <span className="text-[10px] text-[#94A3B8]">{PERIODICITES.find(p => p.value === a.periodicite)?.label}</span>
                      {a.date_debut && (
                        <span className="text-[10px] text-[#94A3B8]">depuis {fmtDate(a.date_debut)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleStatut(a.id, a.statut)}
                      className="text-[10px] px-2 py-1 rounded border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] font-semibold"
                    >
                      {isActif ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-[10px] px-2 py-1 rounded border border-[#FEE2E2] hover:bg-[#FEE2E2] text-[#DC2626] font-semibold"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
