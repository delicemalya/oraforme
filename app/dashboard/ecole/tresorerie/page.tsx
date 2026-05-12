'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, Plus, Trash2, Check, RefreshCw, CreditCard,
  Smartphone, Building2, FileText, ArrowDownCircle,
  ArrowUpCircle, X, AlertTriangle, CheckCircle, Clock,
  ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmt, KpiCard } from '../_lib/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

type WalletType = 'mobile_money' | 'banque'

interface EcoleWallet {
  id: string; tenant_id: string; type: WalletType; provider: string
  nom: string; numero: string | null; solde: number; actif: boolean; created_at: string
}

interface WalletMovement {
  id: string; wallet_id: string; type: 'entree' | 'sortie' | 'transfert'
  montant: number; libelle: string; reference: string | null
  solde_apres: number | null; source: string | null; created_at: string
}

interface EcoleCheque {
  id: string; numero_cheque: string; banque: string; montant: number
  date_emission: string; date_encaissement: string | null
  libelle: string | null; statut: 'recu' | 'encaisse' | 'rejete' | 'annule'
  etudiant_id: string | null; wallet_id: string | null; created_at: string
}

interface EcoleVirement {
  id: string; reference: string; banque: string; montant: number
  date_valeur: string; libelle: string | null
  statut: 'recu' | 'valide' | 'rejete'; wallet_id: string | null; created_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MM_PROVIDERS = [
  { value: 'mtn',    label: 'MTN Money',    color: '#F0A30A' },
  { value: 'airtel', label: 'Airtel Money', color: '#F85149' },
  { value: 'moov',   label: 'Moov Money',   color: '#388BFD' },
  { value: 'orange', label: 'Orange Money', color: '#F97316' },
  { value: 'custom', label: 'Autre',        color: '#8B949E' },
]

const STATUT_CHEQUE: Record<string, { label: string; color: string; bg: string }> = {
  recu:      { label: 'Reçu',      color: '#388BFD', bg: '#388BFD18' },
  encaisse:  { label: 'Encaissé',  color: '#2EA043', bg: '#2EA04318' },
  rejete:    { label: 'Rejeté',    color: '#F85149', bg: '#F8514918' },
  annule:    { label: 'Annulé',    color: '#8B949E', bg: '#8B949E18' },
}

const STATUT_VIREMENT: Record<string, { label: string; color: string; bg: string }> = {
  recu:   { label: 'Reçu',   color: '#388BFD', bg: '#388BFD18' },
  valide: { label: 'Validé', color: '#2EA043', bg: '#2EA04318' },
  rejete: { label: 'Rejeté', color: '#F85149', bg: '#F8514918' },
}

// ── UI Atoms ──────────────────────────────────────────────────────────────────

type TabId = 'vue' | 'wallets' | 'cheques' | 'virements' | 'mouvements'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'vue',        label: 'Vue générale',  icon: Wallet         },
  { id: 'wallets',    label: 'Wallets',       icon: Smartphone     },
  { id: 'cheques',    label: 'Chèques',       icon: FileText       },
  { id: 'virements',  label: 'Virements',     icon: Building2      },
  { id: 'mouvements', label: 'Mouvements',    icon: ArrowDownCircle},
]

function Badge({ statut, map }: { statut: string; map: Record<string, { label: string; color: string; bg: string }> }) {
  const s = map[statut] ?? { label: statut, color: '#8B949E', bg: '#8B949E18' }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  )
}

function FI({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-[#8B949E] mb-1">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0D1117] border border-[#21262D] rounded-lg px-3 py-2.5 text-sm text-[#E6EDF3] placeholder-[#484F58] focus:outline-none focus:border-[#F0A30A]/50"
      />
    </div>
  )
}

function FS({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs text-[#8B949E] mb-1">{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#0D1117] border border-[#21262D] rounded-lg px-3 py-2.5 text-sm text-[#E6EDF3] focus:outline-none focus:border-[#F0A30A]/50"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Section Vue Générale ──────────────────────────────────────────────────────

function SectionVue({ wallets, cheques, virements }: {
  wallets: EcoleWallet[]; cheques: EcoleCheque[]; virements: EcoleVirement[]
}) {
  const totalWallets = wallets.reduce((s, w) => s + w.solde, 0)
  const totalCheques = cheques.filter(c => c.statut === 'recu').reduce((s, c) => s + c.montant, 0)
  const totalVirements = virements.filter(v => v.statut === 'recu').reduce((s, v) => s + v.montant, 0)
  const totalEntrees = cheques.filter(c => c.statut === 'encaisse').reduce((s, c) => s + c.montant, 0)
    + virements.filter(v => v.statut === 'valide').reduce((s, v) => s + v.montant, 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Solde total wallets" value={`${fmt(totalWallets)} F`}  color="#2EA043" />
        <KpiCard label="Chèques en attente"  value={`${fmt(totalCheques)} F`}  color="#F0A30A" />
        <KpiCard label="Virements en attente"value={`${fmt(totalVirements)} F`}color="#388BFD" />
        <KpiCard label="Encaissements"       value={`${fmt(totalEntrees)} F`}  color="#8B5CF6" />
      </div>

      {/* Wallets rapides */}
      <div>
        <h3 className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider mb-3">Wallets actifs</h3>
        {wallets.filter(w => w.actif).length === 0 ? (
          <p className="text-xs text-[#484F58]">Aucun wallet configuré. Ajoutez-en dans l&apos;onglet Wallets.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {wallets.filter(w => w.actif).map(w => {
              const mm = MM_PROVIDERS.find(p => p.value === w.provider)
              const color = w.type === 'banque' ? '#388BFD' : (mm?.color ?? '#8B949E')
              return (
                <div key={w.id} className="flex items-center justify-between p-3 bg-[#161B22] border border-[#21262D] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                      {w.type === 'banque' ? <Building2 size={14} style={{ color }} /> : <Smartphone size={14} style={{ color }} />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#E6EDF3]">{w.nom}</div>
                      <div className="text-[10px] text-[#484F58]">{mm?.label ?? w.provider} {w.numero ? `· ${w.numero}` : ''}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color }}>{fmt(w.solde)} F</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section Wallets ───────────────────────────────────────────────────────────

function SectionWallets({ tenantId, wallets, onRefresh }: {
  tenantId: string; wallets: EcoleWallet[]; onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [activeWallet, setActiveWallet] = useState<EcoleWallet | null>(null)
  const [moveForm, setMoveForm] = useState({ type: 'entree' as 'entree' | 'sortie', montant: '', libelle: '' })
  const [moveSaving, setMoveSaving] = useState(false)

  const [form, setForm] = useState({
    type: 'mobile_money' as WalletType, provider: 'mtn', nom: '', numero: '',
  })

  async function save() {
    if (!form.nom) return
    setSaving(true)
    await supabase.from('ecole_wallets').insert({ tenant_id: tenantId, ...form, numero: form.numero || null })
    setShowForm(false)
    setForm({ type: 'mobile_money', provider: 'mtn', nom: '', numero: '' })
    onRefresh(); setSaving(false)
  }

  async function del(id: string) {
    await supabase.from('ecole_wallets').delete().eq('id', id); onRefresh()
  }

  async function addMovement() {
    if (!activeWallet || !moveForm.montant || !moveForm.libelle) return
    setMoveSaving(true)
    await supabase.from('ecole_wallet_movements').insert({
      tenant_id: tenantId, wallet_id: activeWallet.id,
      type: moveForm.type, montant: parseFloat(moveForm.montant),
      libelle: moveForm.libelle, source: 'manuel',
    })
    setMoveForm({ type: 'entree', montant: '', libelle: '' })
    setActiveWallet(null); onRefresh(); setMoveSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-[#F0A30A] text-black hover:bg-[#F0A30A]/90"
        >
          <Plus size={13} /> Ajouter un wallet
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 bg-[#161B22] border border-[#F0A30A]/30 rounded-xl space-y-3"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold text-[#E6EDF3]">Nouveau wallet</span>
              <button onClick={() => setShowForm(false)}><X size={14} className="text-[#484F58]" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FS label="Type" value={form.type} onChange={v => setForm(p => ({ ...p, type: v as WalletType }))}
                options={[{ value: 'mobile_money', label: 'Mobile Money' }, { value: 'banque', label: 'Banque' }]}
              />
              {form.type === 'mobile_money' ? (
                <FS label="Opérateur" value={form.provider} onChange={v => setForm(p => ({ ...p, provider: v }))}
                  options={MM_PROVIDERS.map(p => ({ value: p.value, label: p.label }))}
                />
              ) : (
                <FI label="Banque" value={form.provider} onChange={v => setForm(p => ({ ...p, provider: v }))} placeholder="Ex: BGFI" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Nom du compte" value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} placeholder="Ex: MTN Direction" />
              <FI label="Numéro (optionnel)" value={form.numero} onChange={v => setForm(p => ({ ...p, numero: v }))} placeholder="06 XX XX XX" />
            </div>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2EA043] text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {wallets.map(w => {
          const mm = MM_PROVIDERS.find(p => p.value === w.provider)
          const color = w.type === 'banque' ? '#388BFD' : (mm?.color ?? '#8B949E')
          return (
            <div key={w.id} className="p-4 bg-[#161B22] border border-[#21262D] rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                    {w.type === 'banque' ? <Building2 size={16} style={{ color }} /> : <Smartphone size={16} style={{ color }} />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#E6EDF3]">{w.nom}</div>
                    <div className="text-xs text-[#484F58]">{mm?.label ?? w.provider}{w.numero ? ` · ${w.numero}` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold" style={{ color }}>{fmt(w.solde)} F</div>
                    <div className="text-[10px] text-[#484F58]">Solde actuel</div>
                  </div>
                  <button
                    onClick={() => setActiveWallet(w)}
                    className="p-2 rounded-lg bg-[#F0A30A]/10 text-[#F0A30A] hover:bg-[#F0A30A]/20 text-xs"
                    title="Enregistrer un mouvement"
                  >
                    <ArrowDownCircle size={14} />
                  </button>
                  <button onClick={() => del(w.id)} className="p-2 rounded-lg text-[#484F58] hover:text-[#F85149] hover:bg-[#F85149]/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Formulaire mouvement inline */}
              <AnimatePresence>
                {activeWallet?.id === w.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-[#21262D] space-y-2"
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <FS label="Type" value={moveForm.type} onChange={v => setMoveForm(p => ({ ...p, type: v as 'entree' | 'sortie' }))}
                        options={[{ value: 'entree', label: '↓ Entrée' }, { value: 'sortie', label: '↑ Sortie' }]}
                      />
                      <FI label="Montant (FCFA)" value={moveForm.montant} onChange={v => setMoveForm(p => ({ ...p, montant: v }))} type="number" />
                      <FI label="Libellé" value={moveForm.libelle} onChange={v => setMoveForm(p => ({ ...p, libelle: v }))} placeholder="Motif" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addMovement} disabled={moveSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2EA043] text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {moveSaving ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />} Valider
                      </button>
                      <button onClick={() => setActiveWallet(null)} className="px-3 py-1.5 rounded-lg text-xs text-[#484F58] hover:text-[#8B949E]">
                        Annuler
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
        {wallets.length === 0 && (
          <div className="flex flex-col items-center py-12 text-[#484F58]">
            <Wallet size={28} className="mb-3 opacity-30" />
            <p className="text-sm">Aucun wallet configuré</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section Chèques ───────────────────────────────────────────────────────────

function SectionCheques({ tenantId, cheques, wallets, onRefresh }: {
  tenantId: string; cheques: EcoleCheque[]; wallets: EcoleWallet[]; onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    numero_cheque: '', banque: '', montant: '', date_emission: '',
    date_encaissement: '', libelle: '', wallet_id: '',
  })

  async function save() {
    if (!form.numero_cheque || !form.banque || !form.montant) return
    setSaving(true)
    await supabase.from('ecole_cheques').insert({
      tenant_id: tenantId, numero_cheque: form.numero_cheque, banque: form.banque,
      montant: parseFloat(form.montant), date_emission: form.date_emission || new Date().toISOString().split('T')[0],
      date_encaissement: form.date_encaissement || null,
      libelle: form.libelle || null,
      wallet_id: form.wallet_id || null, statut: 'recu',
    })
    setShowForm(false)
    setForm({ numero_cheque: '', banque: '', montant: '', date_emission: '', date_encaissement: '', libelle: '', wallet_id: '' })
    onRefresh(); setSaving(false)
  }

  async function encaisser(c: EcoleCheque) {
    if (!c.wallet_id) return
    await supabase.from('ecole_cheques').update({ statut: 'encaisse', date_encaissement: new Date().toISOString().split('T')[0] }).eq('id', c.id)
    // Alimenter le wallet
    await supabase.from('ecole_wallet_movements').insert({
      tenant_id: tenantId, wallet_id: c.wallet_id, type: 'entree',
      montant: c.montant, libelle: `Chèque ${c.numero_cheque} — ${c.banque}`,
      source: 'cheque', source_id: c.id,
    })
    onRefresh()
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('ecole_cheques').update({ statut }).eq('id', id); onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-[#F0A30A] text-black hover:bg-[#F0A30A]/90"
        >
          <Plus size={13} /> Enregistrer un chèque
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 bg-[#161B22] border border-[#F0A30A]/30 rounded-xl space-y-3"
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-[#E6EDF3]">Nouveau chèque</span>
              <button onClick={() => setShowForm(false)}><X size={14} className="text-[#484F58]" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FI label="N° chèque" value={form.numero_cheque} onChange={v => setForm(p => ({ ...p, numero_cheque: v }))} placeholder="CH001" />
              <FI label="Banque émettrice" value={form.banque} onChange={v => setForm(p => ({ ...p, banque: v }))} placeholder="BGFI, UBA…" />
              <FI label="Montant (FCFA)" value={form.montant} onChange={v => setForm(p => ({ ...p, montant: v }))} type="number" />
              <FI label="Date d'émission" value={form.date_emission} onChange={v => setForm(p => ({ ...p, date_emission: v }))} type="date" />
              <FI label="Date d'encaissement (optionnel)" value={form.date_encaissement} onChange={v => setForm(p => ({ ...p, date_encaissement: v }))} type="date" />
              <FS label="Déposer dans (wallet)" value={form.wallet_id} onChange={v => setForm(p => ({ ...p, wallet_id: v }))}
                options={[{ value: '', label: '— Aucun —' }, ...wallets.map(w => ({ value: w.id, label: w.nom }))]}
              />
            </div>
            <FI label="Libellé" value={form.libelle} onChange={v => setForm(p => ({ ...p, libelle: v }))} placeholder="Description du paiement" />
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2EA043] text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {cheques.map(c => (
          <div key={c.id} className="p-4 bg-[#161B22] border border-[#21262D] rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#E6EDF3]">Chèque {c.numero_cheque}</span>
                  <Badge statut={c.statut} map={STATUT_CHEQUE} />
                </div>
                <div className="text-xs text-[#484F58] mt-0.5">{c.banque} · {new Date(c.date_emission).toLocaleDateString('fr-FR')}</div>
                {c.libelle && <div className="text-xs text-[#8B949E] mt-0.5">{c.libelle}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#2EA043]">{fmt(c.montant)} F</span>
                {c.statut === 'recu' && c.wallet_id && (
                  <button onClick={() => encaisser(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2EA043]/10 text-[#2EA043] text-xs font-semibold hover:bg-[#2EA043]/20"
                  >
                    <Check size={11} /> Encaisser
                  </button>
                )}
                {c.statut === 'recu' && (
                  <button onClick={() => updateStatut(c.id, 'rejete')}
                    className="p-1.5 rounded-lg text-[#484F58] hover:text-[#F85149] hover:bg-[#F85149]/10"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {cheques.length === 0 && (
          <div className="flex flex-col items-center py-12 text-[#484F58]">
            <FileText size={28} className="mb-3 opacity-30" />
            <p className="text-sm">Aucun chèque enregistré</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section Virements ─────────────────────────────────────────────────────────

function SectionVirements({ tenantId, virements, wallets, onRefresh }: {
  tenantId: string; virements: EcoleVirement[]; wallets: EcoleWallet[]; onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    reference: '', banque: '', montant: '', date_valeur: '',
    libelle: '', compte_destination: '', wallet_id: '',
  })

  async function save() {
    if (!form.reference || !form.banque || !form.montant) return
    setSaving(true)
    await supabase.from('ecole_virements').insert({
      tenant_id: tenantId, reference: form.reference, banque: form.banque,
      montant: parseFloat(form.montant),
      date_valeur: form.date_valeur || new Date().toISOString().split('T')[0],
      libelle: form.libelle || null, compte_destination: form.compte_destination || null,
      wallet_id: form.wallet_id || null, statut: 'recu',
    })
    setShowForm(false)
    setForm({ reference: '', banque: '', montant: '', date_valeur: '', libelle: '', compte_destination: '', wallet_id: '' })
    onRefresh(); setSaving(false)
  }

  async function valider(v: EcoleVirement) {
    await supabase.from('ecole_virements').update({ statut: 'valide' }).eq('id', v.id)
    if (v.wallet_id) {
      await supabase.from('ecole_wallet_movements').insert({
        tenant_id: tenantId, wallet_id: v.wallet_id, type: 'entree',
        montant: v.montant, libelle: `Virement ${v.reference} — ${v.banque}`,
        source: 'virement', source_id: v.id,
      })
    }
    onRefresh()
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('ecole_virements').update({ statut }).eq('id', id); onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-[#F0A30A] text-black hover:bg-[#F0A30A]/90"
        >
          <Plus size={13} /> Enregistrer un virement
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 bg-[#161B22] border border-[#F0A30A]/30 rounded-xl space-y-3"
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-[#E6EDF3]">Nouveau virement</span>
              <button onClick={() => setShowForm(false)}><X size={14} className="text-[#484F58]" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Référence" value={form.reference} onChange={v => setForm(p => ({ ...p, reference: v }))} placeholder="VIR-2024-001" />
              <FI label="Banque" value={form.banque} onChange={v => setForm(p => ({ ...p, banque: v }))} placeholder="BGFI, UBA…" />
              <FI label="Montant (FCFA)" value={form.montant} onChange={v => setForm(p => ({ ...p, montant: v }))} type="number" />
              <FI label="Date de valeur" value={form.date_valeur} onChange={v => setForm(p => ({ ...p, date_valeur: v }))} type="date" />
              <FI label="Compte destination" value={form.compte_destination} onChange={v => setForm(p => ({ ...p, compte_destination: v }))} placeholder="IBAN / N° compte" />
              <FS label="Créditer dans (wallet)" value={form.wallet_id} onChange={v => setForm(p => ({ ...p, wallet_id: v }))}
                options={[{ value: '', label: '— Aucun —' }, ...wallets.map(w => ({ value: w.id, label: w.nom }))]}
              />
            </div>
            <FI label="Libellé" value={form.libelle} onChange={v => setForm(p => ({ ...p, libelle: v }))} placeholder="Description" />
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2EA043] text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {virements.map(v => (
          <div key={v.id} className="p-4 bg-[#161B22] border border-[#21262D] rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#E6EDF3]">{v.reference}</span>
                  <Badge statut={v.statut} map={STATUT_VIREMENT} />
                </div>
                <div className="text-xs text-[#484F58] mt-0.5">{v.banque} · {new Date(v.date_valeur).toLocaleDateString('fr-FR')}</div>
                {v.libelle && <div className="text-xs text-[#8B949E] mt-0.5">{v.libelle}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#388BFD]">{fmt(v.montant)} F</span>
                {v.statut === 'recu' && (
                  <>
                    <button onClick={() => valider(v)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2EA043]/10 text-[#2EA043] text-xs font-semibold hover:bg-[#2EA043]/20"
                    >
                      <Check size={11} /> Valider
                    </button>
                    <button onClick={() => updateStatut(v.id, 'rejete')}
                      className="p-1.5 rounded-lg text-[#484F58] hover:text-[#F85149] hover:bg-[#F85149]/10"
                    >
                      <X size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {virements.length === 0 && (
          <div className="flex flex-col items-center py-12 text-[#484F58]">
            <Building2 size={28} className="mb-3 opacity-30" />
            <p className="text-sm">Aucun virement enregistré</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section Mouvements ────────────────────────────────────────────────────────

function SectionMouvements({ movements, wallets }: {
  movements: WalletMovement[]; wallets: EcoleWallet[]
}) {
  return (
    <div className="space-y-2">
      {movements.map(m => {
        const wallet = wallets.find(w => w.id === m.wallet_id)
        return (
          <div key={m.id} className="flex items-center gap-3 p-3 bg-[#161B22] border border-[#21262D] rounded-xl">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              m.type === 'entree' ? 'bg-[#2EA043]/15' : 'bg-[#F85149]/15'
            }`}>
              {m.type === 'entree'
                ? <ArrowDownCircle size={14} className="text-[#2EA043]" />
                : <ArrowUpCircle size={14} className="text-[#F85149]" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[#E6EDF3] truncate">{m.libelle}</div>
              <div className="text-xs text-[#484F58]">
                {wallet?.nom ?? 'Wallet inconnu'} · {new Date(m.created_at).toLocaleDateString('fr-FR')}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-sm font-bold ${m.type === 'entree' ? 'text-[#2EA043]' : 'text-[#F85149]'}`}>
                {m.type === 'entree' ? '+' : '-'}{fmt(m.montant)} F
              </div>
              {m.solde_apres !== null && (
                <div className="text-[10px] text-[#484F58]">Solde : {fmt(m.solde_apres)} F</div>
              )}
            </div>
          </div>
        )
      })}
      {movements.length === 0 && (
        <div className="flex flex-col items-center py-12 text-[#484F58]">
          <Clock size={28} className="mb-3 opacity-30" />
          <p className="text-sm">Aucun mouvement enregistré</p>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EcoleTresoreriePage() {
  const { tenantId } = useTenant()

  const [tab,       setTab]       = useState<TabId>('vue')
  const [wallets,   setWallets]   = useState<EcoleWallet[]>([])
  const [movements, setMovements] = useState<WalletMovement[]>([])
  const [cheques,   setCheques]   = useState<EcoleCheque[]>([])
  const [virements, setVirements] = useState<EcoleVirement[]>([])
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [wRes, mRes, cRes, vRes] = await Promise.all([
      supabase.from('ecole_wallets').select('*').eq('tenant_id', tenantId).order('created_at'),
      supabase.from('ecole_wallet_movements').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
      supabase.from('ecole_cheques').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('ecole_virements').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    ])
    setWallets((wRes.data ?? []) as EcoleWallet[])
    setMovements((mRes.data ?? []) as WalletMovement[])
    setCheques((cRes.data ?? []) as EcoleCheque[])
    setVirements((vRes.data ?? []) as EcoleVirement[])
    setLoading(false)
  }, [supabase, tenantId])

  useEffect(() => { load() }, [load])

  const tabContent: Record<TabId, React.ReactNode> = {
    vue:        <SectionVue wallets={wallets} cheques={cheques} virements={virements} />,
    wallets:    tenantId ? <SectionWallets tenantId={tenantId} wallets={wallets} onRefresh={load} /> : null,
    cheques:    tenantId ? <SectionCheques tenantId={tenantId} cheques={cheques} wallets={wallets} onRefresh={load} /> : null,
    virements:  tenantId ? <SectionVirements tenantId={tenantId} virements={virements} wallets={wallets} onRefresh={load} /> : null,
    mouvements: <SectionMouvements movements={movements} wallets={wallets} />,
  }

  return (
    <div className="min-h-screen bg-[#0D1117] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-[#E6EDF3]">Trésorerie</h1>
          <p className="text-sm text-[#8B949E] mt-0.5">Wallets, chèques, virements & mouvements</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#161B22] border border-[#21262D] rounded-xl overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center ${
                tab === t.id ? 'bg-[#F0A30A] text-black' : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-[#484F58]" />
          </div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-5 bg-[#161B22] border border-[#21262D] rounded-xl"
          >
            {tabContent[tab]}
          </motion.div>
        )}
      </div>
    </div>
  )
}
