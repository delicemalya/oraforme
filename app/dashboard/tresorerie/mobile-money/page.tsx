'use client'

/**
 * Mobile Money Enterprise — MTN, Airtel, Orange Congo
 * Wallets, transferts, dépôts, retraits, remboursements
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import { Smartphone, Plus, X, Save, TrendingUp, TrendingDown, Download, AlertTriangle } from 'lucide-react'

interface Wallet {
  id: string; operateur: string; numero: string
  intitule: string; solde: number; actif: boolean
}
interface WalletOp {
  id: string; wallet_id: string; type: 'entree' | 'sortie' | 'frais'
  montant: number; frais: number; libelle: string
  reference: string | null; date_operation: string
}

const OPERATEURS = [
  { id: 'Airtel Money',      label: 'Airtel Money',      color: '#DC2626', bg: '#FEF2F2' },
  { id: 'MTN Mobile Money',  label: 'MTN Mobile Money',  color: '#EAB308', bg: '#FEFCE8' },
  { id: 'Orange Money',      label: 'Orange Money',      color: '#F97316', bg: '#FFF7ED' },
]

function today() { return new Date().toISOString().split('T')[0] }
function getColor(op: string) { return OPERATEURS.find(o => o.id === op)?.color || '#64748B' }
function getBg(op: string)    { return OPERATEURS.find(o => o.id === op)?.bg    || '#F8FAFC' }

export default function MobileMoneyPage() {
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : 'fr-FR'
  const [wallets,   setWallets]   = useState<Wallet[]>([])
  const [ops,       setOps]       = useState<WalletOp[]>([])
  const [selected,  setSelected]  = useState<Wallet | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [opModal,   setOpModal]   = useState<'entree' | 'sortie' | null>(null)
  const [walletModal, setWalletModal] = useState(false)

  const [fWallet, setFWallet] = useState({ operateur: 'Airtel Money', numero: '', intitule: '', solde: '' })
  const [fOp,     setFOp]     = useState({ montant: '', frais: '', libelle: '', reference: '', date_operation: today() })

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data, error } = await supabase.from('wallets').select('*').eq('tenant_id', tenantId).order('created_at').limit(200)
    if (!error) setWallets((data || []) as Wallet[])
    setLoading(false)
  }, [tenantId])

  const loadOps = useCallback(async (walletId: string) => {
    const { data } = await supabase.from('wallet_operations').select('*')
      .eq('wallet_id', walletId).order('date_operation', { ascending: false }).limit(100)
    setOps((data || []) as WalletOp[])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (selected) loadOps(selected.id) }, [selected, loadOps])

  async function createWallet() {
    if (!tenantId || !fWallet.numero || !fWallet.intitule) return
    setSaving(true)
    const { data, error } = await supabase.from('wallets').insert({
      tenant_id: tenantId, operateur: fWallet.operateur, numero: fWallet.numero,
      intitule: fWallet.intitule, solde: parseFloat(fWallet.solde) || 0, actif: true,
    }).select('*').single()
    if (error) showToast(error.message, false)
    else {
      showToast('Wallet créé'); setWalletModal(false)
      setFWallet({ operateur: 'Airtel Money', numero: '', intitule: '', solde: '' })
      await load(); if (data) setSelected(data as Wallet)
    }
    setSaving(false)
  }

  async function saveOp(type: 'entree' | 'sortie') {
    if (!tenantId || !selected || !fOp.montant) return
    const montant = parseFloat(fOp.montant)
    const frais   = parseFloat(fOp.frais) || 0
    if (type === 'sortie' && montant + frais > selected.solde) { showToast('Solde insuffisant', false); return }
    setSaving(true)
    const { error } = await supabase.from('wallet_operations').insert({
      wallet_id: selected.id, tenant_id: tenantId, type, montant, frais,
      libelle: fOp.libelle || (type === 'entree' ? 'Dépôt Mobile Money' : 'Retrait Mobile Money'),
      reference: fOp.reference || null, date_operation: fOp.date_operation,
    })
    if (error) { showToast(error.message, false) } else {
      /* Sync OHADA: Mobile Money ↔ Banque  (compte 514000) */
      await writeComptaEntry({
        tenantId, date: fOp.date_operation,
        libelle: `${type === 'entree' ? 'Dépôt' : 'Retrait'} ${selected.operateur} — ${fOp.libelle || 'MM'}`,
        type: type === 'entree' ? 'recette' : 'depense', montant,
        categorie: 'mobile_money',
        debitAccount: type === 'entree' ? '54' : '521',
        creditAccount: type === 'entree' ? '521' : '54',
        source: 'mobile_money',
      })
      showToast(`${type === 'entree' ? 'Dépôt' : 'Retrait'} de ${fmtFCFA(montant)} enregistré`)
      setOpModal(null)
      setFOp({ montant: '', frais: '', libelle: '', reference: '', date_operation: today() })
      load(); loadOps(selected.id)
    }
    setSaving(false)
  }

  function exportCSV() {
    if (!ops.length) return
    const rows = ops.map(o => ({
      Date: o.date_operation, Type: o.type, Libellé: o.libelle,
      Montant: o.montant, Frais: o.frais, Référence: o.reference || '',
    }))
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `mobile-money-${selected?.operateur}.csv`; a.click()
  }

  const totalMM = wallets.filter(w => w.actif).reduce((s, w) => s + w.solde, 0)
  const opsEntr = ops.filter(o => o.type === 'entree').reduce((s, o) => s + o.montant, 0)
  const opsSortie = ops.filter(o => o.type === 'sortie').reduce((s, o) => s + o.montant, 0)
  const fraisTotal = ops.reduce((s, o) => s + o.frais, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mr-2" />
      <span className="text-[#94A3B8] text-[13px]">{t('common.loading')}</span>
    </div>
  )

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-2xl text-white text-[12px] font-semibold ${toast.ok ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <Smartphone size={22} className="text-[#8B5CF6]" />
            {t('mm.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">{t('mm.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {selected && (
            <>
              <button onClick={exportCSV}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[11px] font-semibold text-[#64748B]">
                <Download size={11} /> CSV
              </button>
              <button onClick={() => setOpModal('entree')}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] text-white rounded-lg text-[12px] font-semibold">
                <TrendingUp size={13} /> Dépôt
              </button>
              <button onClick={() => setOpModal('sortie')}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#DC2626] text-white rounded-lg text-[12px] font-semibold">
                <TrendingDown size={13} /> Retrait
              </button>
            </>
          )}
          <button onClick={() => setWalletModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#8B5CF6] text-white rounded-lg text-[12px] font-semibold">
            <Plus size={13} /> {t('mm.newTransaction')}
          </button>
        </div>
      </div>

      {/* KPI global */}
      {wallets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Mobile Money', value: fmtFCFA(totalMM),     color: '#8B5CF6' },
            { label: 'Total dépôts (actif)', value: fmtFCFA(opsEntr),   color: '#16A34A' },
            { label: 'Total retraits',       value: fmtFCFA(opsSortie), color: '#DC2626' },
            { label: 'Frais prélevés',       value: fmtFCFA(fraisTotal), color: '#D97706' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
              <div className="text-[16px] font-extrabold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Wallets grid */}
      {wallets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] py-16 text-center">
          <Smartphone size={36} className="mx-auto mb-3 text-[#E2E8F0]" />
          <p className="text-[13px] text-[#94A3B8] mb-3">{t('mm.empty')}</p>
          <button onClick={() => setWalletModal(true)}
            className="px-4 py-2 bg-[#8B5CF6] text-white rounded-lg text-[12px] font-semibold">
            Créer mon premier wallet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {wallets.map(w => {
            const color = getColor(w.operateur)
            const bg    = getBg(w.operateur)
            const isSelected = selected?.id === w.id
            return (
              <button key={w.id} onClick={() => setSelected(isSelected ? null : w)}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  isSelected ? 'border-[#8B5CF6] shadow-lg' : 'border-[#E2E8F0] hover:border-[#C4B5FD] bg-white'
                }`}
                style={isSelected ? { background: color + '08' } : {}}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                    <Smartphone size={16} style={{ color }} />
                  </div>
                  <div>
                    <div className="text-[12px] font-extrabold text-[#0F172A]">{w.intitule}</div>
                    <div className="text-[10px]" style={{ color }}>{w.operateur}</div>
                  </div>
                </div>
                <div className="text-[11px] text-[#94A3B8] font-mono">{w.numero}</div>
                <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                  <div className="text-[20px] font-extrabold" style={{ color: w.solde < 5000 ? '#DC2626' : color }}>
                    {fmtFCFA(w.solde)}
                  </div>
                  {w.solde < 5000 && (
                    <div className="flex items-center gap-1 text-[9px] text-[#DC2626] mt-1">
                      <AlertTriangle size={9} /> Solde faible
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Operations history for selected wallet */}
      {selected && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
            <h2 className="text-[13px] font-extrabold text-[#0F172A]">
              Opérations — {selected.intitule}
            </h2>
            <span className="text-[11px] text-[#64748B]">{ops.length} entrées</span>
          </div>
          {ops.length === 0 ? (
            <div className="py-10 text-center text-[#94A3B8] text-[12px]">{t('mm.empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {[t('mm.colDate'), 'Libellé', t('mm.colType'), t('mm.colMontant'), 'Frais', t('mm.colRef')].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ops.map(o => (
                    <tr key={o.id} className="border-t border-[#F8FAFC] hover:bg-[#F8FAFC]">
                      <td className="px-3 py-2 text-[#64748B]">
                        {new Date(o.date_operation).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#0F172A]">{o.libelle}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          o.type === 'entree' ? 'bg-[#F0FDF4] text-[#16A34A]' :
                          o.type === 'frais'  ? 'bg-[#FFFBEB] text-[#D97706]' :
                          'bg-[#FEF2F2] text-[#DC2626]'
                        }`}>
                          {o.type === 'entree' ? t('mm.type.depot') : o.type === 'frais' ? 'Frais' : t('mm.type.retrait')}
                        </span>
                      </td>
                      <td className={`px-3 py-2 font-extrabold ${o.type === 'entree' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                        {o.type === 'entree' ? '+' : '-'}{fmtFCFA(o.montant)}
                      </td>
                      <td className="px-3 py-2 text-[#D97706]">
                        {o.frais > 0 ? fmtFCFA(o.frais) : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[#94A3B8] text-[10px]">{o.reference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Opération */}
      {opModal && selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className={`text-[15px] font-extrabold flex items-center gap-2 ${opModal === 'entree' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                {opModal === 'entree' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {opModal === 'entree' ? 'Dépôt Mobile Money' : 'Retrait Mobile Money'}
              </h2>
              <button onClick={() => setOpModal(null)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: getBg(selected.operateur) }}>
                <Smartphone size={14} style={{ color: getColor(selected.operateur) }} />
                <span className="text-[12px] font-bold" style={{ color: getColor(selected.operateur) }}>
                  {selected.intitule} — {selected.operateur}
                </span>
                <span className="ml-auto text-[11px] font-extrabold text-[#0F172A]">{fmtFCFA(selected.solde)}</span>
              </div>
              {[
                { key: 'montant',       label: 'Montant (FCFA) *',  type: 'number', placeholder: '0' },
                { key: 'frais',         label: 'Frais prélevés',     type: 'number', placeholder: '0' },
                { key: 'libelle',       label: 'Libellé / Description', type: 'text', placeholder: 'Virement client…' },
                { key: 'reference',     label: 'Référence transaction', type: 'text', placeholder: 'TXN123456' },
                { key: 'date_operation', label: 'Date',               type: 'date',   placeholder: '' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                  <input type={f.type} value={(fOp as Record<string, string>)[f.key]}
                    onChange={e => setFOp(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setOpModal(null)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">{t('common.cancel')}</button>
              <button onClick={() => saveOp(opModal)} disabled={saving}
                className={`flex items-center gap-1.5 px-5 py-2 text-white rounded-lg text-[12px] font-semibold disabled:opacity-60 ${opModal === 'entree' ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
                <Save size={13} /> {saving ? '…' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal New Wallet */}
      {walletModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-extrabold text-[#8B5CF6]">Nouveau Wallet</h2>
              <button onClick={() => setWalletModal(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">Opérateur *</label>
                <div className="flex gap-2">
                  {OPERATEURS.map(op => (
                    <button key={op.id} onClick={() => setFWallet(f => ({ ...f, operateur: op.id }))}
                      className="flex-1 py-2 rounded-lg text-[11px] font-bold border transition-all"
                      style={fWallet.operateur === op.id
                        ? { background: op.color, color: 'white', borderColor: op.color }
                        : { background: 'white', borderColor: '#E2E8F0', color: '#64748B' }}>
                      {op.id.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              {[
                { key: 'numero',   label: 'Numéro *',          placeholder: '+242 06 XXX XXXX' },
                { key: 'intitule', label: 'Intitulé *',         placeholder: 'Airtel DG' },
                { key: 'solde',    label: 'Solde initial (FCFA)', placeholder: '0', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{f.label}</label>
                  <input type={f.type || 'text'} value={(fWallet as Record<string, string>)[f.key]}
                    onChange={e => setFWallet(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setWalletModal(false)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">{t('common.cancel')}</button>
              <button onClick={createWallet} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#8B5CF6] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? '…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
