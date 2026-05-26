'use client'

/**
 * Dashboard Trésorerie Enterprise — Vue d'ensemble temps réel
 * Fintech premium · Style Stripe Treasury
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import { resolveAccounts } from '@/lib/accounting-engine'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import Link from 'next/link'
import {
  PiggyBank, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, Landmark, Archive, Smartphone, AlertTriangle,
  CheckCircle2, Clock, Plus, X, Save, ChevronRight, Zap,
} from 'lucide-react'

interface Transaction {
  id: string; type: 'entree' | 'sortie'; categorie: string
  description: string; montant: number; date: string
  mode_paiement: string; source: string; created_at: string
}
interface Caisse         { id: string; nom: string; solde: number }
interface CompteBancaire { id: string; banque: string; intitule: string; solde: number }
interface Wallet         { id: string; operateur: string; intitule: string; solde: number }

const CATS_ENTREE = [
  "Vente / Chiffre d'affaires", 'Frais de scolarité', 'Facture payée',
  'Prestation de services', 'Avance client', 'Virement reçu', 'Remboursement', 'Autre recette',
]
const CATS_SORTIE = [
  'Achats / Fournisseur', 'Loyer', 'Carburant / Transport',
  'Charges diverses', 'Impôts / Taxes', 'CNSS', 'Frais bancaires', 'Autre dépense',
]
const MODES = [
  { value: 'especes',      label: 'Espèces' },
  { value: 'virement',     label: 'Virement bancaire' },
  { value: 'cheque',       label: 'Chèque' },
  { value: 'airtel_money', label: 'Airtel Money' },
  { value: 'mtn_momo',     label: 'MTN MoMo' },
  { value: 'orange_money', label: 'Orange Money' },
]

function today() { return new Date().toISOString().split('T')[0] }

export default function TresorerieDashboard() {
  const { tenantId, loading: tLoading } = useTenant()
  const { t } = useLocale()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [caisses,      setCaisses]      = useState<Caisse[]>([])
  const [banques,      setBanques]      = useState<CompteBancaire[]>([])
  const [wallets,      setWallets]      = useState<Wallet[]>([])
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState<'enc' | 'dec' | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)

  const [fEnc, setFEnc] = useState({ categorie: CATS_ENTREE[0], description: '', montant: '', date: today(), mode: 'especes' })
  const [fDec, setFDec] = useState({ categorie: CATS_SORTIE[0], description: '', montant: '', date: today(), mode: 'especes' })

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - 90)
    const sinceStr = since.toISOString().split('T')[0]

    const [txR, cR, bR, wR] = await Promise.all([
      supabase.from('transactions').select('id,type,categorie,description,montant,date,mode_paiement,source,created_at')
        .eq('tenant_id', tenantId).gte('date', sinceStr).order('date', { ascending: false }).limit(200),
      supabase.from('caisses').select('id,nom,solde').eq('tenant_id', tenantId).eq('actif', true),
      supabase.from('comptes_bancaires').select('id,banque,intitule,solde').eq('tenant_id', tenantId).eq('actif', true),
      supabase.from('wallets').select('id,operateur,intitule,solde').eq('tenant_id', tenantId).eq('actif', true),
    ])
    setTransactions((txR.data || []) as Transaction[])
    setCaisses((cR.data || []) as Caisse[])
    setBanques((bR.data || []) as CompteBancaire[])
    if (wR.error?.code !== '42P01') setWallets((wR.data || []) as Wallet[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tLoading && tenantId) load() }, [tLoading, tenantId, load])

  /* ── KPIs ── */
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`

  const monthTx  = transactions.filter(t => t.date.startsWith(thisMonth))
  const prevTx   = transactions.filter(t => t.date.startsWith(prevMonthStr))
  const encMois  = monthTx.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const decMois  = monthTx.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const encPrev  = prevTx.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const decPrev  = prevTx.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const cashflow = encMois - decMois
  const totalBanque   = banques.reduce((s, b) => s + b.solde, 0)
  const totalCaisse   = caisses.reduce((s, c) => s + c.solde, 0)
  const totalWallets  = wallets.reduce((s, w) => s + w.solde, 0)
  const tresorerie    = totalBanque + totalCaisse + totalWallets

  const pctEnc = encPrev > 0 ? ((encMois - encPrev) / encPrev * 100) : 0
  const pctDec = decPrev > 0 ? ((decMois - decPrev) / decPrev * 100) : 0

  /* 30-day bar chart data (CSS only, no recharts dep) */
  const barData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i))
    const ds = d.toISOString().split('T')[0]
    const e = transactions.filter(t => t.type === 'entree' && t.date === ds).reduce((s, t) => s + t.montant, 0)
    const s = transactions.filter(t => t.type === 'sortie' && t.date === ds).reduce((s, t) => s + t.montant, 0)
    return { e, s, day: d.getDate() }
  })
  const maxBar = Math.max(...barData.map(d => Math.max(d.e, d.s)), 1)

  /* ── Save encaisser ── */
  async function saveEncaisser() {
    if (!tenantId || !fEnc.description || !fEnc.montant) return
    setSaving(true)
    try {
      const montant = parseInt(fEnc.montant)
      const [debit, credit] = resolveAccounts('entree', fEnc.categorie)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: tx } = await supabase.from('transactions').insert({
        tenant_id: tenantId, type: 'entree', categorie: fEnc.categorie,
        description: fEnc.description, montant, date: fEnc.date,
        mode_paiement: fEnc.mode, source: 'tresorerie',
        debit_account: debit, credit_account: credit, created_by: user?.id,
      }).select('id').single()
      await writeComptaEntry({
        tenantId, date: fEnc.date, libelle: fEnc.description,
        type: 'recette', montant, categorie: fEnc.categorie,
        debitAccount: debit, creditAccount: credit,
        source: 'tresorerie', sourceId: tx?.id, createdBy: user?.id,
      })
      showToast(`✓ Encaissement de ${fmtFCFA(montant)} enregistré`)
      setModal(null)
      setFEnc({ categorie: CATS_ENTREE[0], description: '', montant: '', date: today(), mode: 'especes' })
      load()
    } catch (e: unknown) {
      showToast((e as Error)?.message ?? 'Erreur', false)
    }
    setSaving(false)
  }

  /* ── Save décaisser ── */
  async function saveDecaisser() {
    if (!tenantId || !fDec.description || !fDec.montant) return
    setSaving(true)
    try {
      const montant = parseInt(fDec.montant)
      const [debit, credit] = resolveAccounts('sortie', fDec.categorie)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: tx } = await supabase.from('transactions').insert({
        tenant_id: tenantId, type: 'sortie', categorie: fDec.categorie,
        description: fDec.description, montant, date: fDec.date,
        mode_paiement: fDec.mode, source: 'tresorerie',
        debit_account: debit, credit_account: credit, created_by: user?.id,
      }).select('id').single()
      await writeComptaEntry({
        tenantId, date: fDec.date, libelle: fDec.description,
        type: 'depense', montant, categorie: fDec.categorie,
        debitAccount: debit, creditAccount: credit,
        source: 'tresorerie', sourceId: tx?.id, createdBy: user?.id,
      })
      showToast(`✓ Décaissement de ${fmtFCFA(montant)} enregistré`)
      setModal(null)
      setFDec({ categorie: CATS_SORTIE[0], description: '', montant: '', date: today(), mode: 'especes' })
      load()
    } catch (e: unknown) {
      showToast((e as Error)?.message ?? 'Erreur', false)
    }
    setSaving(false)
  }

  if (tLoading || loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-[#0891B2] border-t-transparent rounded-full animate-spin mr-2" />
      <span className="text-[#94A3B8] text-[13px]">{t('treso.loading')}</span>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-white text-[12px] font-semibold transition-all ${
          toast.ok ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <PiggyBank size={22} className="text-[#0891B2]" />
            {t('treso.enterprise')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('treso.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 bg-white border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#F8FAFC]">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setModal('enc')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] text-white rounded-lg text-[12px] font-semibold hover:bg-[#15803D]">
            <ArrowUpCircle size={13} /> {t('treso.encaisser')}
          </button>
          <button onClick={() => setModal('dec')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#DC2626] text-white rounded-lg text-[12px] font-semibold hover:bg-[#B91C1C]">
            <ArrowDownCircle size={13} /> {t('treso.decaisser')}
          </button>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: t('treso.globalTreasury'), value: tresorerie,
            sub: t('treso.bankPlusCash'), icon: PiggyBank,
            gradient: 'from-[#0891B2] to-[#0E7490]', trend: null,
          },
          {
            label: t('treso.receipts'), value: encMois,
            sub: `${monthTx.filter(tx => tx.type === 'entree').length} ${t('treso.opsCount')}`,
            icon: TrendingUp, gradient: 'from-[#16A34A] to-[#15803D]', trend: pctEnc,
          },
          {
            label: t('treso.payments'), value: decMois,
            sub: `${monthTx.filter(tx => tx.type === 'sortie').length} ${t('treso.opsCount')}`,
            icon: TrendingDown, gradient: 'from-[#DC2626] to-[#B91C1C]', trend: pctDec,
          },
          {
            label: t('treso.netCashflow'), value: cashflow,
            sub: cashflow >= 0 ? t('treso.positivePos') : t('treso.deficitMonth'),
            icon: Zap, gradient: cashflow >= 0 ? 'from-[#8B5CF6] to-[#7C3AED]' : 'from-[#DC2626] to-[#B91C1C]',
            trend: null,
          },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className={`rounded-2xl bg-gradient-to-br ${k.gradient} p-4 text-white relative overflow-hidden`}>
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{k.label}</span>
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                  <Icon size={14} />
                </div>
              </div>
              <div className="text-[22px] font-extrabold leading-none mb-1">{fmtFCFA(k.value)}</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">{k.sub}</span>
                {k.trend !== null && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/15 ${k.trend >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                    {k.trend >= 0 ? '+' : ''}{k.trend.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column: accounts + chart */}
        <div className="lg:col-span-2 space-y-4">

          {/* Account breakdown */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-extrabold text-[#0F172A]">{t('treso.fundsBreakdown')}</h2>
              <span className="text-[11px] font-bold text-[#0891B2]">{fmtFCFA(tresorerie)} {t('treso.totalLabel')}</span>
            </div>
            <div className="space-y-3">
              {/* Banques */}
              {banques.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Landmark size={13} className="text-[#0891B2]" />
                    <span className="text-[11px] font-bold text-[#64748B] uppercase">{t('treso.banks')}</span>
                    <span className="ml-auto text-[12px] font-extrabold text-[#0891B2]">{fmtFCFA(totalBanque)}</span>
                  </div>
                  {banques.map(b => (
                    <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-[#F8FAFC] rounded-lg mb-1">
                      <div>
                        <div className="text-[11px] font-semibold text-[#0F172A]">{b.intitule}</div>
                        <div className="text-[10px] text-[#94A3B8]">{b.banque}</div>
                      </div>
                      <span className="text-[12px] font-extrabold text-[#0F172A]">{fmtFCFA(b.solde)}</span>
                    </div>
                  ))}
                  {banques.length === 0 && (
                    <p className="text-[11px] text-[#94A3B8] py-2">{t('treso.noBankAccount')}</p>
                  )}
                </div>
              )}
              {/* Caisses */}
              {caisses.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Archive size={13} className="text-[#D97706]" />
                    <span className="text-[11px] font-bold text-[#64748B] uppercase">{t('treso.cashLabel')}</span>
                    <span className="ml-auto text-[12px] font-extrabold text-[#D97706]">{fmtFCFA(totalCaisse)}</span>
                  </div>
                  {caisses.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-[#FFFBEB] rounded-lg mb-1">
                      <span className="text-[11px] font-semibold text-[#0F172A]">{c.nom}</span>
                      <span className={`text-[12px] font-extrabold ${c.solde < 50000 ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                        {fmtFCFA(c.solde)}
                        {c.solde < 50000 && <span className="ml-1 text-[9px]">⚠</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Mobile Money */}
              {wallets.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone size={13} className="text-[#8B5CF6]" />
                    <span className="text-[11px] font-bold text-[#64748B] uppercase">{t('treso.mobile')}</span>
                    <span className="ml-auto text-[12px] font-extrabold text-[#8B5CF6]">{fmtFCFA(totalWallets)}</span>
                  </div>
                  {wallets.map(w => (
                    <div key={w.id} className="flex items-center justify-between py-2 px-3 bg-[#F5F3FF] rounded-lg mb-1">
                      <div>
                        <div className="text-[11px] font-semibold text-[#0F172A]">{w.intitule}</div>
                        <div className="text-[10px] text-[#94A3B8]">{w.operateur}</div>
                      </div>
                      <span className="text-[12px] font-extrabold text-[#8B5CF6]">{fmtFCFA(w.solde)}</span>
                    </div>
                  ))}
                </div>
              )}
              {banques.length === 0 && caisses.length === 0 && wallets.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[13px] text-[#94A3B8]">{t('treso.noAccount')}</p>
                  <div className="flex gap-2 justify-center mt-3">
                    <Link href="/dashboard/tresorerie/banques"
                      className="text-[11px] px-3 py-1.5 bg-[#EFF6FF] text-[#0891B2] rounded-lg font-semibold">
                      + Banque
                    </Link>
                    <Link href="/dashboard/tresorerie/caisses"
                      className="text-[11px] px-3 py-1.5 bg-[#FFFBEB] text-[#D97706] rounded-lg font-semibold">
                      + Caisse
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cashflow Chart 30 jours */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-extrabold text-[#0F172A]">{t('treso.cashflow30')}</h2>
              <div className="flex gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#16A34A] inline-block" />{t('treso.entries')}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#DC2626] inline-block" />{t('treso.exits')}</span>
              </div>
            </div>
            <div className="flex items-end gap-0.5 h-28">
              {barData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col-reverse items-center gap-0.5">
                    <div className="w-full rounded-t"
                      style={{ height: `${(d.s / maxBar) * 80}px`, background: '#DC2626', minHeight: d.s > 0 ? '2px' : '0', opacity: 0.75 }} />
                    <div className="w-full rounded-t"
                      style={{ height: `${(d.e / maxBar) * 80}px`, background: '#16A34A', minHeight: d.e > 0 ? '2px' : '0' }} />
                  </div>
                  {i % 6 === 0 && (
                    <span className="text-[8px] text-[#94A3B8]">{d.day}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: quick access + recent transactions */}
        <div className="space-y-4">

          {/* Quick access modules */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4">
            <h2 className="text-[13px] font-extrabold text-[#0F172A] mb-3">{t('treso.quickAccess')}</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/dashboard/tresorerie/caisses',        label: 'Caisses',          icon: Archive,       color: '#D97706' },
                { href: '/dashboard/tresorerie/banques',        label: 'Banques',          icon: Landmark,      color: '#0891B2' },
                { href: '/dashboard/tresorerie/mobile-money',   label: 'Mobile Money',     icon: Smartphone,    color: '#8B5CF6' },
                { href: '/dashboard/tresorerie/encaissements',  label: 'Encaisser',        icon: ArrowUpCircle, color: '#16A34A' },
                { href: '/dashboard/tresorerie/decaissements',  label: 'Décaisser',        icon: ArrowDownCircle, color: '#DC2626' },
                { href: '/dashboard/tresorerie/transferts',     label: 'Transferts',       icon: RefreshCw,     color: '#7C3AED' },
                { href: '/dashboard/tresorerie/validations',    label: 'Validations',      icon: CheckCircle2,  color: '#0891B2' },
                { href: '/dashboard/tresorerie/analytics',      label: 'Analytics',        icon: TrendingUp,    color: '#0F172A' },
              ].map(m => {
                const Icon = m.icon
                return (
                  <Link key={m.href} href={m.href}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] group transition-all">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: m.color + '15' }}>
                      <Icon size={13} style={{ color: m.color }} />
                    </div>
                    <span className="text-[11px] font-semibold text-[#0F172A] leading-tight">{m.label}</span>
                    <ChevronRight size={10} className="ml-auto text-[#C8D3E1] group-hover:text-[#0891B2] transition-colors" />
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
              <h2 className="text-[13px] font-extrabold text-[#0F172A]">{t('treso.lastTransactions')}</h2>
              <Link href="/dashboard/tresorerie/historique"
                className="text-[11px] text-[#0891B2] font-semibold hover:underline">
                {t('treso.seeAll')}
              </Link>
            </div>
            {transactions.length === 0 ? (
              <div className="text-center py-10 text-[#94A3B8] text-[12px]">{t('treso.noTransaction')}</div>
            ) : (
              <div className="divide-y divide-[#F8FAFC]">
                {transactions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'entree' ? 'bg-[#F0FDF4]' : 'bg-[#FEF2F2]'
                    }`}>
                      {tx.type === 'entree'
                        ? <ArrowUpCircle size={13} className="text-[#16A34A]" />
                        : <ArrowDownCircle size={13} className="text-[#DC2626]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-[#0F172A] truncate">{tx.description}</p>
                      <p className="text-[10px] text-[#94A3B8]">
                        {new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {tx.mode_paiement}
                      </p>
                    </div>
                    <span className={`text-[12px] font-extrabold shrink-0 ${
                      tx.type === 'entree' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}>
                      {tx.type === 'entree' ? '+' : '-'}{fmtFCFA(tx.montant)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          {(caisses.some(c => c.solde < 50000) || cashflow < 0) && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#DC2626]">
                <AlertTriangle size={14} />
                <span className="text-[12px] font-extrabold">{t('treso.alertsTitle')}</span>
              </div>
              {caisses.filter(c => c.solde < 50000).map(c => (
                <div key={c.id} className="flex items-start gap-2">
                  <span className="text-[10px] text-[#DC2626]">• {t('treso.cashLabel')} {c.nom} : {t('treso.lowCash')} ({fmtFCFA(c.solde)})</span>
                </div>
              ))}
              {cashflow < 0 && (
                <span className="block text-[10px] text-[#DC2626]">
                  • {t('treso.negativeCashflow')} : {fmtFCFA(cashflow)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('treso.bankAccounts2'), value: banques.length,  color: '#0891B2' },
          { label: t('treso.activeCash'),    value: caisses.length,  color: '#D97706' },
          { label: t('treso.mobileWallets2'),value: wallets.length,  color: '#8B5CF6' },
          { label: t('treso.opsThisMonth'),  value: monthTx.length,  color: '#0F172A' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <div className="text-[22px] font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Encaisser Modal */}
      {modal === 'enc' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-extrabold text-[#16A34A] flex items-center gap-2">
                <ArrowUpCircle size={16} /> {t('treso.encaissement')}
              </h2>
              <button onClick={() => setModal(null)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('treso.category')}</label>
                <select value={fEnc.categorie} onChange={e => setFEnc(f => ({ ...f, categorie: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30">
                  {CATS_ENTREE.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('treso.descriptionField')}</label>
                <input value={fEnc.description} onChange={e => setFEnc(f => ({ ...f, description: e.target.value }))}
                  placeholder="Facture #001 — Client XYZ"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('treso.amountField')}</label>
                  <input type="number" value={fEnc.montant} onChange={e => setFEnc(f => ({ ...f, montant: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('common.date')}</label>
                  <input type="date" value={fEnc.date} onChange={e => setFEnc(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('treso.paymentMode')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {MODES.map(m => (
                    <button key={m.value} onClick={() => setFEnc(f => ({ ...f, mode: m.value }))}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                        fEnc.mode === m.value ? 'bg-[#16A34A] text-white border-[#16A34A]' : 'bg-white border-[#E2E8F0] text-[#64748B]'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">
                {t('common.cancel')}
              </button>
              <button onClick={saveEncaisser} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#16A34A] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? t('treso.registering') : t('treso.register')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Décaisser Modal */}
      {modal === 'dec' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-extrabold text-[#DC2626] flex items-center gap-2">
                <ArrowDownCircle size={16} /> {t('treso.decaissement')}
              </h2>
              <button onClick={() => setModal(null)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('treso.category')}</label>
                <select value={fDec.categorie} onChange={e => setFDec(f => ({ ...f, categorie: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30">
                  {CATS_SORTIE.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('treso.descriptionField')}</label>
                <input value={fDec.description} onChange={e => setFDec(f => ({ ...f, description: e.target.value }))}
                  placeholder="Achat fournitures bureau"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('treso.amountField')}</label>
                  <input type="number" value={fDec.montant} onChange={e => setFDec(f => ({ ...f, montant: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('common.date')}</label>
                  <input type="date" value={fDec.date} onChange={e => setFDec(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1">{t('treso.paymentMode')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {MODES.map(m => (
                    <button key={m.value} onClick={() => setFDec(f => ({ ...f, mode: m.value }))}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                        fDec.mode === m.value ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white border-[#E2E8F0] text-[#64748B]'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[12px] font-semibold">
                {t('common.cancel')}
              </button>
              <button onClick={saveDecaisser} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#DC2626] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60">
                <Save size={13} /> {saving ? t('treso.registering') : t('treso.register')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
