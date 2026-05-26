'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Plus, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { fmtFCFA } from '@/lib/admin-config'

type Fournisseur = { id: string; nom: string; contact: string; telephone: string; email: string; solde_du: number; created_at: string }
type Achat = { id: string; fournisseur_id: string; description: string; montant: number; statut: string; date: string }
type CostCenter = { id: string; code: string; nom: string }

const STATUT_COLORS: Record<string, string> = {
  impaye: 'text-[#DC2626] bg-[#DC2626]/10 border-[#DC2626]/30',
  partiel: 'text-[#DC2626] bg-[#DC2626]/10 border-[#DC2626]/30',
  paye: 'text-[#16A34A] bg-[#16A34A]/10 border-[#16A34A]/30',
}

export default function AchatsPage() {
  const { t } = useLocale()
  const [tab, setTab] = useState(0)
  const [fournisseurs,  setFournisseurs]  = useState<Fournisseur[]>([])
  const [achats,        setAchats]        = useState<Achat[]>([])
  const [costCenters,   setCostCenters]   = useState<CostCenter[]>([])
  const { tenantId, loading: tLoading } = useTenant()
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'fournisseur' | 'achat' | null>(null)
  const [saving, setSaving] = useState(false)
  const [fForm, setFForm] = useState({ nom: '', contact: '', telephone: '', email: '' })
  const [aForm, setAForm] = useState({ fournisseur_id: '', description: '', montant: '', date: new Date().toISOString().split('T')[0], cost_center_id: '' })

  const TABS = [t('achats.tabFournisseurs'), t('achats.tabAchats'), t('achats.tabDettes')]
  const STATUT_LABELS: Record<string, string> = {
    impaye: t('achats.statut.impaye'),
    partiel: t('achats.statut.partiel'),
    paye: t('achats.statut.paye'),
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    const [{ data: f }, { data: a }, { data: cc }] = await Promise.all([
      supabase.from('fournisseurs').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('achats').select('*').eq('tenant_id', tenantId).order('date', { ascending: false }),
      supabase.from('cost_centers').select('id, code, nom').eq('tenant_id', tenantId).order('code'),
    ])
    setFournisseurs(f ?? [])
    setAchats(a ?? [])
    setCostCenters(cc ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tLoading && tenantId) load() }, [tLoading, tenantId, load])

  async function saveFournisseur() {
    if (!fForm.nom || !tenantId) return
    setSaving(true)
    await supabase.from('fournisseurs').insert({ tenant_id: tenantId, ...fForm, solde_du: 0 })
    setModal(null); setFForm({ nom: '', contact: '', telephone: '', email: '' }); setSaving(false); load()
  }

  async function saveAchat() {
    if (!aForm.description || !aForm.montant || !tenantId) return
    setSaving(true)
    await supabase.from('achats').insert({
      tenant_id:      tenantId,
      fournisseur_id: aForm.fournisseur_id || null,
      description:    aForm.description,
      montant:        parseInt(aForm.montant),
      statut:         'impaye',
      date:           aForm.date,
      cost_center_id: aForm.cost_center_id || null,
    })
    setModal(null)
    setAForm({ fournisseur_id: '', description: '', montant: '', date: new Date().toISOString().split('T')[0], cost_center_id: '' })
    setSaving(false)
    load()
  }

  async function payerAchat(id: string) {
    const achat = achats.find(a => a.id === id)
    await supabase.from('achats').update({ statut: 'paye', date_paiement: new Date().toISOString().split('T')[0] }).eq('id', id)
    if (achat && tenantId) {
      const f = fournisseurs.find(fz => fz.id === achat.fournisseur_id)
      const { data: { user } } = await supabase.auth.getUser()
      // D 401000 Fournisseurs / C 571000 Caisse (règlement fournisseur)
      await supabase.from('transactions').insert({
        tenant_id:      tenantId,
        type:           'sortie',
        categorie:      'Achats fournisseurs',
        description:    `Paiement — ${achat.description}${f ? ` (${f.nom})` : ''}`,
        montant:        achat.montant,
        date:           new Date().toISOString().split('T')[0],
        mode_paiement:  'especes',
        source:         'achat',
        source_id:      id,
        debit_account:  '401000',
        credit_account: '571000',
        created_by:     user?.id,
      })
    }
    load()
  }

  const totalDu = achats.filter(a => a.statut !== 'paye').reduce((s, a) => s + a.montant, 0)
  const debtsByFournisseur = fournisseurs
    .map(f => ({
      ...f,
      dette: achats.filter(a => a.fournisseur_id === f.id && a.statut !== 'paye').reduce((s, a) => s + a.montant, 0),
    }))
    .filter(f => f.dette > 0)
    .sort((a, b) => b.dette - a.dette)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center">
          <ShoppingCart size={18} className="text-[#7C3AED]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">{t('achats.pageTitle')}</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {fournisseurs.length} {fournisseurs.length > 1 ? t('achats.fournisseurPl') : t('achats.fournisseurSg')} ·
            <span className="text-[#DC2626] ml-1">{t('achats.dettesLabel')} {fmtFCFA(totalDu)}</span>
          </p>
        </div>
        <button onClick={() => setModal(tab === 0 ? 'fournisseur' : 'achat')}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-[#7C3AED] text-sm font-medium hover:bg-[#7C3AED]/20 transition-colors">
          <Plus size={15} /> {tab === 0 ? t('achats.btnFournisseur') : t('achats.btnAchat')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-1">
        {TABS.map((tabLabel, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === i ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}>
            {tabLabel}
            {i === 2 && debtsByFournisseur.length > 0 && (
              <span className="ml-1.5 text-xs bg-[#DC2626] text-white rounded-full px-1.5 py-0.5">{debtsByFournisseur.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 0 — Fournisseurs */}
      {tab === 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 size={18} className="animate-spin text-[var(--text-secondary)]" /></div>
          ) : fournisseurs.length === 0 ? (
            <div className="p-10 text-center text-[var(--text-secondary)] text-sm">{t('achats.noFournisseur')}</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {fournisseurs.map(f => {
                const dette = achats.filter(a => a.fournisseur_id === f.id && a.statut !== 'paye').reduce((s, a) => s + a.montant, 0)
                return (
                  <div key={f.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5/30 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center shrink-0">
                      <span className="text-[#7C3AED] text-sm font-bold">{f.nom.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{f.nom}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{f.telephone || f.contact || f.email || '—'}</p>
                    </div>
                    {dette > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#DC2626]">{fmtFCFA(dette)}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{t('achats.du')}</p>
                      </div>
                    )}
                    {dette === 0 && <CheckCircle size={16} className="text-[#16A34A]" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 1 — Achats */}
      {tab === 1 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {[t('achats.colDate'), t('achats.colDescription'), t('achats.colFournisseur'), t('achats.colMontant'), t('achats.colStatut'), ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading && <tr><td colSpan={6} className="text-center py-8"><Loader2 size={18} className="animate-spin text-[var(--text-secondary)] mx-auto" /></td></tr>}
                {!loading && achats.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-[var(--text-secondary)]">{t('achats.noAchat')}</td></tr>
                )}
                {achats.map(a => {
                  const f = fournisseurs.find(f => f.id === a.fournisseur_id)
                  return (
                    <tr key={a.id} className="hover:bg-white/5/30">
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs whitespace-nowrap">
                        {new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text)] max-w-[180px] truncate">{a.description}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs">{f?.nom ?? '—'}</td>
                      <td className="px-4 py-2.5 font-medium text-[var(--text)] whitespace-nowrap">{fmtFCFA(a.montant)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded border ${STATUT_COLORS[a.statut] ?? STATUT_COLORS.impaye}`}>
                          {STATUT_LABELS[a.statut] ?? a.statut}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {a.statut !== 'paye' && (
                          <button onClick={() => payerAchat(a.id)}
                            className="text-xs text-[#16A34A] hover:underline">{t('achats.payer')}</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {achats.filter(a => a.statut !== 'paye').length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between bg-[#DC2626]/5">
              <span className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                <AlertCircle size={14} className="text-[#DC2626]" />
                {t('achats.totalNonPaye')}
              </span>
              <span className="text-sm font-bold text-[#DC2626]">{fmtFCFA(totalDu)}</span>
            </div>
          )}
        </div>
      )}

      {/* Tab 2 — Dettes */}
      {tab === 2 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          {debtsByFournisseur.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle size={32} className="text-[#16A34A] mx-auto mb-3" />
              <p className="text-sm text-[var(--text)] font-medium">{t('achats.noDette')}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('achats.achatsJour')}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {debtsByFournisseur.map(f => {
                const factures = achats.filter(a => a.fournisseur_id === f.id && a.statut !== 'paye')
                return (
                  <div key={f.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">{f.nom}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {factures.length} {factures.length > 1 ? t('achats.achatPl') : t('achats.achatSg')} {factures.length > 1 ? t('achats.impayePl') : t('achats.impayeSg')}
                        </p>
                      </div>
                      <p className="text-base font-bold text-[#DC2626]">{fmtFCFA(f.dette)}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await Promise.all(factures.map(a => payerAchat(a.id)))
                      }}
                      className="w-full py-2 rounded-lg text-xs font-medium bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] hover:bg-[#16A34A]/20 transition-colors">
                      {t('achats.toutPayer')} {fmtFCFA(f.dette)}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60" onClick={() => setModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"><X size={16} /></button>
              <h3 className="text-base font-bold text-[var(--text)] mb-4">
                {modal === 'fournisseur' ? t('achats.newFournisseur') : t('achats.newAchat')}
              </h3>
              {modal === 'fournisseur' ? (
                <div className="space-y-3">
                  {[
                    { key: 'nom', label: t('achats.nomLabel'), placeholder: t('achats.nomPlaceholder') },
                    { key: 'contact', label: t('achats.contactLabel'), placeholder: t('achats.contactPlaceholder') },
                    { key: 'telephone', label: t('achats.telephoneLabel'), placeholder: '0X XXX XXXX' },
                    { key: 'email', label: t('achats.emailLabel'), placeholder: 'email@example.com' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">{field.label}</label>
                      <input value={fForm[field.key as keyof typeof fForm]}
                        onChange={e => setFForm(f => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#64748B] outline-none focus:border-[#7C3AED]/50" />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)]">{t('common.cancel')}</button>
                    <button onClick={saveFournisseur} disabled={saving || !fForm.nom}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#7C3AED] text-white hover:bg-[#7C3AED]/90 disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving && <Loader2 size={13} className="animate-spin" />} {t('common.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">{t('achats.fournisseurLabel')}</label>
                    <select value={aForm.fournisseur_id} onChange={e => setAForm(f => ({ ...f, fournisseur_id: e.target.value }))}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                      <option value="">{t('achats.sansFournisseur')}</option>
                      {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">{t('achats.descriptionLabel')}</label>
                    <input value={aForm.description} onChange={e => setAForm(f => ({ ...f, description: e.target.value }))}
                      placeholder={t('achats.descriptionPlaceholder')}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#64748B] outline-none focus:border-[#7C3AED]/50" />
                  </div>
                  {costCenters.length > 0 && (
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">{t('achats.centreCout')}</label>
                      <select value={aForm.cost_center_id} onChange={e => setAForm(f => ({ ...f, cost_center_id: e.target.value }))}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                        <option value="">{t('achats.aucunCentre')}</option>
                        {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.code} — {cc.nom}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">{t('achats.montantLabel')}</label>
                      <input type="number" value={aForm.montant} onChange={e => setAForm(f => ({ ...f, montant: e.target.value }))}
                        placeholder="0"
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#64748B] outline-none focus:border-[#7C3AED]/50" />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">{t('achats.dateLabel')}</label>
                      <input type="date" value={aForm.date} onChange={e => setAForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)]">{t('common.cancel')}</button>
                    <button onClick={saveAchat} disabled={saving || !aForm.description || !aForm.montant}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#7C3AED] text-white hover:bg-[#7C3AED]/90 disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving && <Loader2 size={13} className="animate-spin" />} {t('common.save')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
