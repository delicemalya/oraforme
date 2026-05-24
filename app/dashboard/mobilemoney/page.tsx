'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Smartphone, ArrowDownLeft, ArrowUpRight, Link2, X, Loader2, Copy, Check } from 'lucide-react'
import { fmtFCFA } from '@/lib/admin-config'

type MobileTx = {
  id: string
  operateur: 'airtel' | 'mtn' | 'wave' | 'orange'
  type: 'envoi' | 'reception'
  numero_destinataire: string
  nom_destinataire: string
  montant: number
  frais: number
  reference: string
  statut: string
  date: string
}

const FRAIS: Record<string, number> = { airtel: 0.01, mtn: 0.012, wave: 0.008, orange: 0.011 }
const OP_LABELS: Record<string, string> = { airtel: 'Airtel Money', mtn: 'MTN MoMo', wave: 'Wave', orange: 'Orange Money' }
const OP_COLORS: Record<string, string> = { airtel: '#DC2626', mtn: '#DC2626', wave: '#DC2626', orange: '#DC2626' }

export default function MobileMoneyPage() {
  const [txs, setTxs] = useState<MobileTx[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'recevoir' | 'envoyer' | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    operateur: 'airtel' as 'airtel' | 'mtn' | 'wave' | 'orange',
    type: 'reception' as 'envoi' | 'reception',
    numero: '',
    nom: '',
    montant: '',
    reference: '',
  })

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) return
    const { data } = await supabase
      .from('mobile_money_transactions').select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('date', { ascending: false })
    setTxs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!form.montant) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { data: profile } = await supabase
      .from('profiles').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) { setSaving(false); return }

    const montant = parseInt(form.montant)
    const frais = Math.round(montant * (FRAIS[form.operateur] ?? 0.01))
    await supabase.from('mobile_money_transactions').insert({
      tenant_id: profile.tenant_id,
      operateur: form.operateur,
      type: form.type,
      numero_destinataire: form.numero,
      nom_destinataire: form.nom,
      montant,
      frais: form.type === 'envoi' ? frais : 0,
      reference: form.reference || `REF-${Date.now()}`,
      statut: 'confirme',
      date: new Date().toISOString(),
    })
    setModal(null)
    setSaving(false)
    setForm({ operateur: 'airtel', type: 'reception', numero: '', nom: '', montant: '', reference: '' })
    load()
  }

  const totalRecu  = txs.filter(t => t.type === 'reception').reduce((s, t) => s + t.montant, 0)
  const totalEnvoi = txs.filter(t => t.type === 'envoi').reduce((s, t) => s + t.montant, 0)
  const totalFrais = txs.reduce((s, t) => s + (t.frais ?? 0), 0)

  const airtelTxs = txs.filter(t => t.operateur === 'airtel')
  const mtnTxs    = txs.filter(t => t.operateur === 'mtn')
  const airtelSolde = airtelTxs.filter(t => t.type === 'reception').reduce((s, t) => s + t.montant, 0)
                    - airtelTxs.filter(t => t.type === 'envoi').reduce((s, t) => s + t.montant + t.frais, 0)
  const mtnSolde  = mtnTxs.filter(t => t.type === 'reception').reduce((s, t) => s + t.montant, 0)
                  - mtnTxs.filter(t => t.type === 'envoi').reduce((s, t) => s + t.montant + t.frais, 0)

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--surface)]/10 border border-[#0F172A]/20 flex items-center justify-center">
          <Smartphone size={18} className="text-[#DC2626]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Mobile Money</h1>
          <p className="text-xs text-[var(--text-secondary)]">Airtel Money · MTN MoMo · Wave · Orange Money</p>
        </div>
      </div>

      {/* Wallets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { op: 'airtel', solde: airtelSolde, num: '06 XXX XXX' },
          { op: 'mtn',    solde: mtnSolde,   num: '05 XXX XXX' },
        ].map(w => (
          <div key={w.op} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5"
            style={{ borderTop: `3px solid ${OP_COLORS[w.op]}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone size={16} style={{ color: OP_COLORS[w.op] }} />
                <span className="text-sm font-semibold text-[var(--text)]">{OP_LABELS[w.op]}</span>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">{w.num}</span>
            </div>
            <p className={`text-2xl font-bold ${w.solde >= 0 ? 'text-[#DC2626]' : 'text-[#DC2626]'}`}>
              {fmtFCFA(w.solde)}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Solde estimé</p>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total reçu', value: fmtFCFA(totalRecu), color: '#0F172A' },
          { label: 'Total envoyé', value: fmtFCFA(totalEnvoi), color: '#DC2626' },
          { label: 'Frais payés', value: fmtFCFA(totalFrais), color: '#8B949E' },
        ].map(k => (
          <div key={k.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 text-center">
            <p className="text-xs text-[var(--text-secondary)] mb-1">{k.label}</p>
            <p className="text-base font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => { setForm(f => ({ ...f, type: 'reception' })); setModal('recevoir') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface)]/10 border border-[#0F172A]/30 text-[#DC2626] text-sm font-medium hover:bg-[var(--surface)]/20 transition-colors">
          <ArrowDownLeft size={15} /> Recevoir paiement
        </button>
        <button onClick={() => { setForm(f => ({ ...f, type: 'envoi' })); setModal('envoyer') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-sm font-medium hover:bg-[#DC2626]/20 transition-colors">
          <ArrowUpRight size={15} /> Envoyer de l&apos;argent
        </button>
      </div>

      {/* Transactions */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">Historique transactions</h2>
          <span className="text-xs text-[var(--text-secondary)]">{txs.length} transaction{txs.length > 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={18} className="animate-spin text-[var(--text-secondary)]" /></div>
        ) : txs.length === 0 ? (
          <div className="p-10 text-center text-[var(--text-secondary)] text-sm">Aucune transaction Mobile Money</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {txs.slice(0, 50).map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5/30">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: OP_COLORS[t.operateur] + '20' }}>
                  <Smartphone size={13} style={{ color: OP_COLORS[t.operateur] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] truncate">{t.nom_destinataire || t.numero_destinataire || 'Transaction'}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{OP_LABELS[t.operateur]} · {t.reference}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${t.type === 'reception' ? 'text-[#DC2626]' : 'text-[#DC2626]'}`}>
                    {t.type === 'reception' ? '+' : '-'}{fmtFCFA(t.montant)}
                  </p>
                  {t.frais > 0 && <p className="text-xs text-[var(--text-secondary)]">Frais : {fmtFCFA(t.frais)}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded border ${
                  t.statut === 'confirme' ? 'text-[#DC2626] bg-[var(--surface)]/10 border-[#0F172A]/30'
                  : 'text-[var(--text-secondary)] bg-[var(--surface-alt)] border-[var(--border)]'
                }`}>{t.statut}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60" onClick={() => setModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"><X size={16} /></button>
              <h3 className="text-base font-bold text-[var(--text)] mb-4">
                {modal === 'recevoir' ? '📥 Recevoir un paiement' : '📤 Envoyer de l\'argent'}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Opérateur</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['airtel', 'mtn', 'wave', 'orange'] as const).map(op => (
                      <button key={op} onClick={() => setForm(f => ({ ...f, operateur: op }))}
                        className={`py-2 rounded-lg text-xs font-medium transition-colors border ${
                          form.operateur === op
                            ? 'border-current'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                        }`}
                        style={form.operateur === op ? { color: OP_COLORS[op], backgroundColor: OP_COLORS[op] + '15', borderColor: OP_COLORS[op] + '50' } : {}}>
                        {OP_LABELS[op].split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Montant (FCFA)</label>
                  <input type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#64748B] outline-none focus:border-[#0F172A]/50" />
                  {form.type === 'envoi' && form.montant && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Frais : {fmtFCFA(Math.round(parseInt(form.montant||'0') * (FRAIS[form.operateur] ?? 0.01)))}
                    </p>
                  )}
                </div>
                {modal === 'envoyer' && (
                  <>
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">Numéro destinataire</label>
                      <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                        placeholder="0X XXX XXXX"
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#64748B] outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">Nom destinataire</label>
                      <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                        placeholder="Nom du bénéficiaire"
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#64748B] outline-none" />
                    </div>
                  </>
                )}
                {modal === 'recevoir' && form.montant && (
                  <div className="bg-[var(--surface)]/5 border border-[#0F172A]/20 rounded-lg p-3">
                    <p className="text-xs text-[var(--text-secondary)] mb-2">Partagez cette référence de paiement :</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm text-[#DC2626] font-mono bg-[var(--surface)] rounded px-2 py-1">
                        PAY-{form.operateur.toUpperCase()}-{form.montant}FCFA
                      </code>
                      <button onClick={() => copyToClipboard(`PAY-${form.operateur.toUpperCase()}-${form.montant}FCFA`)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[#DC2626] transition-colors">
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                  Annuler
                </button>
                <button onClick={save} disabled={saving || !form.montant}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--surface)] text-[#101729] border border-[var(--border)] hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Confirmer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
