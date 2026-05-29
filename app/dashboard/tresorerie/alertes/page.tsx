'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import {
  Bell, Plus, Check, X, Loader2, Eye,
  AlertTriangle, AlertCircle, Info, CheckCircle2,
  TrendingDown, Archive, Building2, Smartphone, Wallet2,
  Settings, Trash2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AlertConfig {
  id: string
  tenant_id: string
  type: string
  libelle: string
  seuil: number
  compte_id: string | null
  compte_type: string | null
  actif: boolean
  last_triggered: string | null
  created_at: string
}

interface AlerteActive {
  id: string
  config_id: string | null
  type: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  montant: number | null
  compte: string | null
  lue: boolean
  created_at: string
}

const ALERT_TYPES = [
  { value: 'solde_min_caisse',   label: 'Solde caisse minimum',     icon: Archive,       seuil_default: 50000 },
  { value: 'solde_min_banque',   label: 'Solde banque minimum',      icon: Building2,     seuil_default: 500000 },
  { value: 'solde_min_mobile',   label: 'Solde mobile minimum',      icon: Smartphone,    seuil_default: 10000 },
  { value: 'cashflow_negatif',   label: 'Cashflow mensuel négatif',  icon: TrendingDown,  seuil_default: 0 },
  { value: 'dette_fournisseur',  label: 'Dettes fournisseurs élevées',icon: AlertTriangle, seuil_default: 1000000 },
  { value: 'creance_client',     label: 'Créances clients en retard',icon: AlertCircle,   seuil_default: 500000 },
  { value: 'decaissement_max',   label: 'Décaissement exceptionnel', icon: TrendingDown,  seuil_default: 1000000 },
  { value: 'echeance_paiement',  label: 'Échéance de paiement',      icon: Bell,          seuil_default: 0 },
]

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; Icon: React.ElementType; label: string }> = {
  info:     { color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',   Icon: Info,           label: 'Information' },
  warning:  { color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200', Icon: AlertTriangle,  label: 'Avertissement' },
  critical: { color: 'text-red-600',    bg: 'bg-red-50 border-red-200',     Icon: AlertCircle,    label: 'Critique' },
}

export default function AlertesPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [configs, setConfigs]       = useState<AlertConfig[]>([])
  const [alertes, setAlertes]       = useState<AlerteActive[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [tab, setTab]               = useState<'alertes' | 'config'>('alertes')
  const [form, setForm]             = useState({
    type: 'solde_min_caisse',
    libelle: '',
    seuil: '50000',
    compte_type: '',
  })

  // Auto-generated alerts from DB data
  const [autoAlerts, setAutoAlerts] = useState<AlerteActive[]>([])

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [{ data: cfgs }, { data: alts }, { data: caisses }, { data: banques }, { data: wallets }, { data: txs }] = await Promise.all([
        supabase.from('alertes_config').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
        supabase.from('alertes_tresorerie').select('*').eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('caisses').select('id,nom,solde').eq('tenant_id', tenantId).eq('actif', true).limit(200),
        supabase.from('comptes_bancaires').select('id,intitule,banque,solde').eq('tenant_id', tenantId).eq('actif', true).limit(200),
        supabase.from('wallets').select('id,intitule,operateur,solde').eq('tenant_id', tenantId).eq('actif', true).limit(200),
        supabase.from('transactions').select('type,montant,date').eq('tenant_id', tenantId)
          .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)).limit(200),
      ])

      if (cfgs) setConfigs(cfgs)
      if (alts) setAlertes(alts)

      // Generate auto alerts
      const generated: AlerteActive[] = []
      const now = new Date().toISOString()

      // Caisse bas
      ;(caisses ?? []).forEach((c: { id: string; nom: string; solde: number }) => {
        if (c.solde < 50000) {
          generated.push({
            id: `auto_caisse_${c.id}`,
            config_id: null,
            type: 'solde_min_caisse',
            message: `Caisse "${c.nom}" : solde faible (${fmtFCFA(c.solde)})`,
            severity: c.solde < 10000 ? 'critical' : 'warning',
            montant: c.solde,
            compte: c.nom,
            lue: false,
            created_at: now,
          })
        }
      })

      // Banque bas
      ;(banques ?? []).forEach((b: { id: string; intitule: string; banque: string; solde: number }) => {
        if (b.solde < 100000) {
          generated.push({
            id: `auto_banque_${b.id}`,
            config_id: null,
            type: 'solde_min_banque',
            message: `Compte "${b.intitule}" (${b.banque}) : solde faible (${fmtFCFA(b.solde)})`,
            severity: b.solde < 0 ? 'critical' : 'warning',
            montant: b.solde,
            compte: b.intitule,
            lue: false,
            created_at: now,
          })
        }
      })

      // Wallet bas
      ;(wallets ?? []).forEach((w: { id: string; intitule: string; operateur: string; solde: number }) => {
        if (w.solde < 5000) {
          generated.push({
            id: `auto_wallet_${w.id}`,
            config_id: null,
            type: 'solde_min_mobile',
            message: `Wallet "${w.intitule}" (${w.operateur}) : solde faible (${fmtFCFA(w.solde)})`,
            severity: 'warning',
            montant: w.solde,
            compte: w.intitule,
            lue: false,
            created_at: now,
          })
        }
      })

      // Cashflow ce mois
      if (txs) {
        const entrees = txs.filter((t: { type: string; montant: number }) => t.type === 'entree').reduce((s: number, t: { montant: number }) => s + t.montant, 0)
        const sorties = txs.filter((t: { type: string; montant: number }) => t.type === 'sortie').reduce((s: number, t: { montant: number }) => s + t.montant, 0)
        if (sorties > entrees) {
          generated.push({
            id: 'auto_cashflow',
            config_id: null,
            type: 'cashflow_negatif',
            message: `Cashflow mensuel négatif: ${fmtFCFA(entrees - sorties)} (entrées: ${fmtFCFA(entrees)}, sorties: ${fmtFCFA(sorties)})`,
            severity: 'warning',
            montant: entrees - sorties,
            compte: null,
            lue: false,
            created_at: now,
          })
        }
      }

      setAutoAlerts(generated)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function saveConfig() {
    if (!tenantId || !form.libelle || !form.type) return
    setSaving(true)
    try {
      const { error } = await supabase.from('alertes_config').insert({
        tenant_id: tenantId,
        type: form.type,
        libelle: form.libelle,
        seuil: parseInt(form.seuil || '0'),
        compte_type: form.compte_type || null,
        actif: true,
      })
      if (error) throw error
      setForm({ type: 'solde_min_caisse', libelle: '', seuil: '50000', compte_type: '' })
      setShowModal(false)
      await load()
    } catch (e: unknown) {
      alert('Erreur: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  async function toggleConfig(cfg: AlertConfig) {
    await supabase.from('alertes_config').update({ actif: !cfg.actif }).eq('id', cfg.id)
    setConfigs(prev => prev.map(c => c.id === cfg.id ? { ...c, actif: !c.actif } : c))
  }

  async function deleteConfig(id: string) {
    if (!confirm('Supprimer cette configuration d\'alerte ?')) return
    await supabase.from('alertes_config').delete().eq('id', id)
    setConfigs(prev => prev.filter(c => c.id !== id))
  }

  async function markRead(id: string) {
    await supabase.from('alertes_tresorerie').update({ lue: true }).eq('id', id)
    setAlertes(prev => prev.map(a => a.id === id ? { ...a, lue: true } : a))
  }

  const allAlerts = [...autoAlerts, ...alertes]
  const unreadCount = allAlerts.filter(a => !a.lue).length
  const criticalCount = allAlerts.filter(a => a.severity === 'critical').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Bell size={20} className="text-red-600" />
            </div>
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('treso.alertes.title')}</h1>
            <p className="text-xs text-[#64748B]">
              {criticalCount > 0 && <span className="text-red-600 font-semibold">{criticalCount} critique{criticalCount > 1 ? 's' : ''} · </span>}
              {unreadCount} alerte{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#F1F5F9] rounded-xl p-0.5">
            {(['alertes', 'config'] as const).map(tab_ => (
              <button key={tab_} onClick={() => setTab(tab_)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tab === tab_ ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                }`}>
                {tab_ === 'alertes' ? 'Alertes' : 'Configuration'}
              </button>
            ))}
          </div>
          {tab === 'config' && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm">
              <Plus size={14} /> {t('treso.alertes.newAlert')}
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('treso.alertes.kpi.active'), value: allAlerts.length, color: 'text-[#0891B2]', bg: 'bg-cyan-50', icon: Bell },
          { label: t('treso.alertes.kpi.critical'), value: criticalCount, color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
          { label: t('treso.alertes.kpi.warning'), value: allAlerts.filter(a => a.severity === 'warning').length, color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${k.bg}`}>
                <k.icon size={14} className={k.color} />
              </div>
              <span className="text-[11px] text-[#64748B]">{k.label}</span>
            </div>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#0891B2]" /></div>
      ) : tab === 'alertes' ? (
        <div className="space-y-3">
          {allAlerts.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
              <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#0F172A]">{t('treso.alertes.noAlerts')}</p>
              <p className="text-xs text-[#94A3B8]">Tous les indicateurs sont dans les limites normales</p>
            </div>
          ) : (
            allAlerts.map(a => {
              const sev = SEVERITY_CONFIG[a.severity] ?? SEVERITY_CONFIG.info
              const SevIcon = sev.Icon
              const typeConf = ALERT_TYPES.find(t => t.value === a.type)
              const TypeIcon = typeConf?.icon ?? Bell
              return (
                <div key={a.id} className={`border rounded-2xl p-4 transition-opacity ${sev.bg} ${a.lue ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.severity === 'critical' ? 'bg-red-100' : a.severity === 'warning' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                        <SevIcon size={16} className={sev.color} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${sev.color}`}>{sev.label}</span>
                          {typeConf && (
                            <span className="text-[10px] text-[#94A3B8] flex items-center gap-0.5">
                              <TypeIcon size={9} /> {typeConf.label}
                            </span>
                          )}
                          {!a.lue && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                        </div>
                        <p className="text-xs font-medium text-[#0F172A]">{a.message}</p>
                        {a.montant !== null && (
                          <p className="text-[10px] text-[#64748B] mt-0.5">
                            Montant: <span className={`font-semibold ${a.montant < 0 ? 'text-red-600' : 'text-[#0F172A]'}`}>{fmtFCFA(a.montant)}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">
                          {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    {!a.lue && !a.id.startsWith('auto_') && (
                      <button onClick={() => markRead(a.id)}
                        className="p-1.5 hover:bg-white/60 rounded-lg shrink-0" title="Marquer comme lue">
                        <Check size={13} className={sev.color} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* Configuration tab */
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
            <div className="font-semibold mb-1">Alertes automatiques actives :</div>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Solde caisse &lt; 50 000 FCFA → alerte critique si &lt; 10 000 FCFA</li>
              <li>Solde compte bancaire &lt; 100 000 FCFA → alerte critique si négatif</li>
              <li>Solde wallet &lt; 5 000 FCFA</li>
              <li>Cashflow mensuel négatif</li>
            </ul>
          </div>

          {configs.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center">
              <Settings size={28} className="text-[#94A3B8] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#0F172A]">Aucune règle personnalisée</p>
              <p className="text-xs text-[#94A3B8] mt-1">Créez des règles d'alerte personnalisées</p>
            </div>
          ) : (
            <div className="space-y-2">
              {configs.map(cfg => {
                const typeConf = ALERT_TYPES.find(t => t.value === cfg.type)
                const Icon = typeConf?.icon ?? Bell
                return (
                  <div key={cfg.id} className={`bg-white border border-[#E2E8F0] rounded-2xl p-4 flex items-center justify-between transition-opacity ${!cfg.actif ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#F1F5F9] flex items-center justify-center">
                        <Icon size={14} className="text-[#64748B]" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#0F172A]">{cfg.libelle}</div>
                        <div className="text-[10px] text-[#94A3B8]">{typeConf?.label ?? cfg.type} — seuil: {fmtFCFA(cfg.seuil)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleConfig(cfg)}
                        className={`w-9 h-5 rounded-full transition-colors ${cfg.actif ? 'bg-green-500' : 'bg-[#CBD5E1]'} relative`}>
                        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${cfg.actif ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                      <button onClick={() => deleteConfig(cfg.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Config modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Nouvelle règle d'alerte</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Type d'alerte</label>
                <select value={form.type} onChange={e => {
                  const alertType = ALERT_TYPES.find(a => a.value === e.target.value)
                  setForm(f => ({ ...f, type: e.target.value, seuil: String(alertType?.seuil_default ?? 0), libelle: alertType?.label ?? '' }))
                }}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  {ALERT_TYPES.map(alertType => <option key={alertType.value} value={alertType.value}>{alertType.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Libellé *</label>
                <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Seuil déclencheur (FCFA)</label>
                <input type="number" value={form.seuil} onChange={e => setForm(f => ({ ...f, seuil: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={saveConfig} disabled={saving || !form.libelle}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
