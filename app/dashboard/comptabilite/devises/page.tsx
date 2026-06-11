'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  DEVISES, TAUX_REFERENCE, PARITE_EUR_XAF, formatDevise,
  type TauxChange,
} from '@/lib/syscohada/multidevises'
import { Globe, Plus, X, CheckCircle2, RefreshCw, ChevronLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const DEVISES_LIST = Object.values(DEVISES).filter(d => d.code !== 'XAF')

export default function DevisesPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const [taux, setTaux]       = useState<TauxChange[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saveOk, setSaveOk]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [form, setForm] = useState({
    devise_source: 'EUR',
    taux:          PARITE_EUR_XAF,
    date_taux:     new Date().toISOString().slice(0, 10),
    source_taux:   'manuel' as TauxChange['source_taux'],
    notes:         '',
  })

  async function loadTaux() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('taux_change')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_taux', { ascending: false })
      .limit(100)
    setTaux((data || []) as TauxChange[])
    setLoading(false)
  }

  useEffect(() => { loadTaux() }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!tenantId || !form.taux || !form.devise_source) {
      setError('Devise et taux obligatoires')
      return
    }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('taux_change').insert({
      tenant_id:    tenantId,
      devise_source: form.devise_source,
      devise_cible:  'XAF',
      taux:          form.taux,
      date_taux:     form.date_taux,
      source_taux:   form.source_taux,
      notes:         form.notes.trim() || null,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setSaveOk(true)
    await loadTaux()
    setTimeout(() => { setSaveOk(false); setShowForm(false) }, 1000)
    setSaving(false)
  }

  async function deleteTaux(id: string) {
    await supabase.from('taux_change').delete().eq('id', id)
    setTaux(prev => prev.filter(t => t.id !== id))
  }

  // Dernier taux par devise
  const derniersTaux: Record<string, TauxChange> = {}
  for (const t of taux) {
    if (!derniersTaux[t.devise_source]) derniersTaux[t.devise_source] = t
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      Chargement des taux…
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/comptabilite"
            className="p-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
              <Globe size={22} className="text-[#2563EB]" />
              Gestion des Devises
            </h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              SYSCOHADA · Taux de change XAF · Comptes 676/776
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadTaux}
            className="p-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC]">
            <RefreshCw size={14} className="text-[#64748B]" />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-bold rounded-lg">
            <Plus size={13} /> Nouveau taux
          </button>
        </div>
      </div>

      {/* Parité fixe EUR info */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={16} className="text-[#2563EB] shrink-0 mt-0.5" />
        <div className="text-[12px] text-[#1E40AF]">
          <p className="font-bold mb-0.5">Parité fixe officielle BCEAO</p>
          <p>
            Le Franc CFA (XAF) est arrimé à l&apos;Euro depuis 1999 : <strong>1 EUR = {PARITE_EUR_XAF} XAF</strong>.
            Cette parité est garantie par la Banque de France et ne varie pas.
            Les autres devises (USD, GBP…) varient selon le marché.
          </p>
          <p className="mt-1 text-[11px] opacity-80">
            Comptes SYSCOHADA : 676 Pertes de change (charge) · 776 Gains de change (produit)
          </p>
        </div>
      </div>

      {/* Tableau des taux actuels */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-4 py-3 bg-[#EFF6FF] border-b border-[#E2E8F0] flex items-center justify-between">
          <p className="text-[12px] font-bold text-[#2563EB]">Taux de change actuels (→ XAF)</p>
          <span className="text-[10px] text-[#94A3B8]">{Object.keys(derniersTaux).length} devise{Object.keys(derniersTaux).length > 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y divide-[#F1F5F9]">
          {/* EUR fixe */}
          <div className="p-4 text-center">
            <p className="text-[11px] text-[#94A3B8] font-semibold mb-1">EUR</p>
            <p className="text-[20px] font-extrabold text-[#0F172A]">{PARITE_EUR_XAF}</p>
            <p className="text-[10px] text-[#16A34A] font-semibold mt-0.5">Parité fixe BCEAO</p>
          </div>
          {/* Autres devises depuis DB */}
          {DEVISES_LIST.filter(d => d.code !== 'EUR').map(d => {
            const tc = derniersTaux[d.code]
            const tRef = TAUX_REFERENCE[d.code]
            return (
              <div key={d.code} className="p-4 text-center">
                <p className="text-[11px] text-[#94A3B8] font-semibold mb-1">{d.code}</p>
                {tc ? (
                  <>
                    <p className="text-[20px] font-extrabold text-[#0F172A]">{tc.taux.toLocaleString('fr-FR')}</p>
                    <p className="text-[10px] text-[#64748B] mt-0.5">{new Date(tc.date_taux).toLocaleDateString('fr-FR')}</p>
                  </>
                ) : tRef ? (
                  <>
                    <p className="text-[20px] font-extrabold text-[#94A3B8]">{tRef.toLocaleString('fr-FR')}</p>
                    <p className="text-[10px] text-[#F59E0B] font-semibold mt-0.5">Indicatif — à confirmer</p>
                  </>
                ) : (
                  <>
                    <p className="text-[20px] font-extrabold text-[#E2E8F0]">—</p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">Non configuré</p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Exemples de conversion */}
      {Object.keys(derniersTaux).length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <p className="text-[11px] font-bold text-[#64748B]">EXEMPLES DE CONVERSION (1 000 unités → FCFA)</p>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {[
              { devise: 'EUR', taux: PARITE_EUR_XAF },
              ...Object.values(derniersTaux).filter(t => t.devise_source !== 'EUR'),
            ].map(t => {
              const taux = typeof t === 'number' ? t : (t as TauxChange).taux
              const devise = typeof t === 'number' ? 'EUR' : (t as TauxChange).devise_source
              const d = DEVISES[devise]
              return (
                <div key={devise} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[12px] text-[#64748B]">
                    1 000 {d?.symbole ?? devise} ({d?.nom ?? devise})
                  </span>
                  <span className="text-[13px] font-bold text-[#0F172A]">
                    = {fmtFCFA(1000 * taux)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Historique des taux */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#EFF6FF] border-b border-[#E2E8F0]">
          <p className="text-[12px] font-bold text-[#2563EB]">Historique des taux saisis</p>
        </div>
        {taux.length === 0 ? (
          <p className="px-4 py-6 text-[12px] text-[#94A3B8] text-center">
            Aucun taux saisi — utilisez &ldquo;Nouveau taux&rdquo; pour ajouter le premier
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left px-4 py-2 text-[11px] text-[#94A3B8] font-semibold">Devise</th>
                  <th className="text-right px-4 py-2 text-[11px] text-[#94A3B8] font-semibold">1 unité = … FCFA</th>
                  <th className="text-left px-4 py-2 text-[11px] text-[#94A3B8] font-semibold">Date</th>
                  <th className="text-left px-4 py-2 text-[11px] text-[#94A3B8] font-semibold">Source</th>
                  <th className="px-4 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {taux.map(t => {
                  const d = DEVISES[t.devise_source]
                  return (
                    <tr key={t.id} className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-[#2563EB] mr-1.5">{t.devise_source}</span>
                        <span className="text-[#64748B]">{d?.nom ?? ''}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-[#0F172A]">
                        {t.taux.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-2.5 text-[#64748B]">
                        {new Date(t.date_taux).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded font-semibold">
                          {t.source_taux}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => t.id && deleteTaux(t.id)}
                          className="text-[#94A3B8] hover:text-[#DC2626]">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nouveau taux */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[#0F172A]">Nouveau taux de change → XAF</h2>
              <button onClick={() => { setShowForm(false); setError(null) }}>
                <X size={18} className="text-[#94A3B8]" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Devise source *</label>
                  <select value={form.devise_source}
                    onChange={e => {
                      const ref = TAUX_REFERENCE[e.target.value]
                      setForm(f => ({ ...f, devise_source: e.target.value, taux: ref ?? f.taux }))
                    }}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30">
                    {DEVISES_LIST.map(d => (
                      <option key={d.code} value={d.code}>{d.code} — {d.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date du taux</label>
                  <input type="date" value={form.date_taux}
                    onChange={e => setForm(f => ({ ...f, date_taux: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
                  1 {form.devise_source} = ? FCFA *
                </label>
                <input type="number" min="0.000001" step="0.01"
                  value={form.taux}
                  onChange={e => setForm(f => ({ ...f, taux: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
                {form.taux > 0 && (
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Exemple : 1 000 {form.devise_source} = {fmtFCFA(1000 * form.taux)}
                  </p>
                )}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Source du taux</label>
                <select value={form.source_taux}
                  onChange={e => setForm(f => ({ ...f, source_taux: e.target.value as TauxChange['source_taux'] }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none">
                  <option value="manuel">Manuel</option>
                  <option value="bceao">BCEAO</option>
                  <option value="banque_de_france">Banque de France</option>
                  <option value="marche">Marché (cotation bancaire)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Notes</label>
                <input value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optionnel"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
              </div>
              {error  && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>}
              {saveOk && (
                <p className="text-[12px] text-[#16A34A] bg-[#DCFCE7] px-3 py-2 rounded-lg flex items-center gap-1">
                  <CheckCircle2 size={13} /> Taux enregistré !
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Enregistrer le taux
                </button>
                <button onClick={() => { setShowForm(false); setError(null) }}
                  className="px-4 py-2.5 border border-[#E2E8F0] rounded-xl text-[12px] text-[#64748B]">
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
