'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import {
  AlertTriangle, Bell, CheckCircle2, Package,
  TrendingDown, RefreshCw, Settings,
  Calendar, Zap
} from 'lucide-react'

interface StockAlerte {
  id: string
  type: 'rupture' | 'stock_faible' | 'surplus' | 'peremption' | 'mouvement_anormal'
  product_id: string
  product_nom: string
  product_sku: string
  product_unite: string
  stock_actuel: number
  seuil: number
  stock_max: number | null
  message: string
  priorite: 'haute' | 'moyenne' | 'basse'
  lue: boolean
  created_at: string
}

interface AlertConfig {
  seuil_stock_faible_global: number
  notif_rupture: boolean
  notif_stock_faible: boolean
  notif_surplus: boolean
}

const PRIORITE_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  haute:   { color: '#DC2626', bg: '#FEF2F2', dot: 'bg-[#DC2626]' },
  moyenne: { color: '#D97706', bg: '#FFFBEB', dot: 'bg-[#D97706]' },
  basse:   { color: '#2563EB', bg: '#EFF6FF', dot: 'bg-[#2563EB]' },
}

const TYPE_CONFIG: Record<string, { label: string; icon: any }> = {
  rupture:           { label: 'Rupture de stock',   icon: AlertTriangle },
  stock_faible:      { label: 'Stock faible',        icon: TrendingDown },
  surplus:           { label: 'Surplus',             icon: Package },
  peremption:        { label: 'Péremption proche',   icon: Calendar },
  mouvement_anormal: { label: 'Mouvement anormal',   icon: Zap },
}

export default function AlertesStocksPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [alertes, setAlertes] = useState<StockAlerte[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'alertes' | 'config'>('alertes')
  const [typeFilter, setTypeFilter] = useState('')
  const [prioriteFilter, setPrioriteFilter] = useState('')
  const [showLues, setShowLues] = useState(false)

  const [config, setConfig] = useState<AlertConfig>({
    seuil_stock_faible_global: 10,
    notif_rupture: true,
    notif_stock_faible: true,
    notif_surplus: false,
  })

  const generateAlertes = useCallback(async () => {
    if (!tenantId) return []
    const { data: prods } = await supabase
      .from('products')
      .select('id, nom, sku, unite, stock_actuel, seuil_alerte, stock_max, prix_achat')
      .eq('tenant_id', tenantId)

    const generated: StockAlerte[] = []
    const now = new Date().toISOString()

    for (const p of (prods || [])) {
      const stock = p.stock_actuel || 0
      const seuil = p.seuil_alerte || config.seuil_stock_faible_global

      if (stock <= 0 && config.notif_rupture) {
        generated.push({
          id: `rupt-${p.id}`,
          type: 'rupture',
          product_id: p.id,
          product_nom: p.nom,
          product_sku: p.sku,
          product_unite: p.unite,
          stock_actuel: stock,
          seuil: seuil,
          stock_max: p.stock_max,
          message: `Rupture de stock — ${p.nom} (stock: 0 ${p.unite})`,
          priorite: 'haute',
          lue: false,
          created_at: now,
        })
      } else if (stock <= seuil && stock > 0 && config.notif_stock_faible) {
        generated.push({
          id: `faible-${p.id}`,
          type: 'stock_faible',
          product_id: p.id,
          product_nom: p.nom,
          product_sku: p.sku,
          product_unite: p.unite,
          stock_actuel: stock,
          seuil: seuil,
          stock_max: p.stock_max,
          message: `Stock faible — ${p.nom}: ${stock} ${p.unite} (seuil: ${seuil})`,
          priorite: 'moyenne',
          lue: false,
          created_at: now,
        })
      } else if (p.stock_max && stock >= p.stock_max && config.notif_surplus) {
        generated.push({
          id: `surplus-${p.id}`,
          type: 'surplus',
          product_id: p.id,
          product_nom: p.nom,
          product_sku: p.sku,
          product_unite: p.unite,
          stock_actuel: stock,
          seuil: seuil,
          stock_max: p.stock_max,
          message: `Surplus de stock — ${p.nom}: ${stock} ${p.unite} (max: ${p.stock_max})`,
          priorite: 'basse',
          lue: false,
          created_at: now,
        })
      }
    }

    return generated
  }, [tenantId, config])

  const load = useCallback(async () => {
    setLoading(true)
    const generated = await generateAlertes()
    setAlertes(generated)
    setLoading(false)
  }, [generateAlertes])

  useEffect(() => { load() }, [load])

  const markLue = (id: string) => {
    setAlertes(als => als.map(a => a.id === id ? { ...a, lue: true } : a))
  }

  const markAllLues = () => {
    setAlertes(als => als.map(a => ({ ...a, lue: true })))
  }

  const filtered = alertes
    .filter(a => !typeFilter || a.type === typeFilter)
    .filter(a => !prioriteFilter || a.priorite === prioriteFilter)
    .filter(a => showLues || !a.lue)

  const nonLues = alertes.filter(a => !a.lue)
  const ruptures = alertes.filter(a => a.type === 'rupture')
  const faibles = alertes.filter(a => a.type === 'stock_faible')
  const hautes = alertes.filter(a => a.priorite === 'haute')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <AlertTriangle size={20} className="text-[#16A34A]" />
            {t('stock.alertes.title')}
            {nonLues.length > 0 && (
              <span className="bg-[#DC2626] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {nonLues.length}
              </span>
            )}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.alertes.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC]">
            <RefreshCw size={13} /> {t('common.refresh')}
          </button>
          {nonLues.length > 0 && (
            <button onClick={markAllLues}
              className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC]">
              <CheckCircle2 size={13} /> {t('stock.alertes.colAction')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] p-1 rounded-xl w-fit">
        {[
          { id: 'alertes', label: `${t('stock.alertes.title')} (${alertes.length})`, icon: Bell },
          { id: 'config', label: 'Configuration', icon: Settings },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}>
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'alertes' ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t('stock.alertes.title'), value: nonLues.length, icon: Bell, color: '#DC2626', bg: '#FEF2F2' },
              { label: t('stock.alertes.critical'), value: ruptures.length, icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
              { label: t('stock.alertes.low'), value: faibles.length, icon: TrendingDown, color: '#D97706', bg: '#FFFBEB' },
              { label: 'Priorité haute', value: hautes.length, icon: Zap, color: '#7C3AED', bg: '#F5F3FF' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                    <k.icon size={14} style={{ color: k.color }} />
                  </div>
                  <span className="text-[11px] text-[#64748B]">{k.label}</span>
                </div>
                <p className="text-lg font-bold text-[#0F172A]">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3 flex flex-wrap gap-3">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
              <option value="">Tous les types</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={prioriteFilter} onChange={e => setPrioriteFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
              <option value="">Toutes priorités</option>
              <option value="haute">🔴 Haute</option>
              <option value="moyenne">🟡 Moyenne</option>
              <option value="basse">🔵 Basse</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setShowLues(v => !v)}
                className={`w-9 h-5 rounded-full transition-colors relative ${showLues ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showLues ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-[#374151]">Afficher lues</span>
            </label>
          </div>

          {/* Alert list */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">{t('common.loading')}</div>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
                  <CheckCircle2 size={40} className="mx-auto text-[#16A34A] mb-3" />
                  <p className="text-sm font-semibold text-[#0F172A]">{t('stock.alertes.empty')}</p>
                  <p className="text-xs text-[#64748B] mt-1">Tous les stocks sont dans les niveaux normaux</p>
                </div>
              ) : filtered.map(alert => {
                const prCfg = PRIORITE_CONFIG[alert.priorite]
                const typCfg = TYPE_CONFIG[alert.type]
                const TypeIcon = typCfg?.icon || AlertTriangle
                return (
                  <div key={alert.id}
                    className={`bg-white border rounded-2xl p-4 flex items-start gap-3 transition-opacity ${
                      alert.lue ? 'opacity-50' : ''
                    }`}
                    style={{ borderColor: alert.lue ? '#E2E8F0' : prCfg.color + '40' }}>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${alert.lue ? 'bg-[#CBD5E1]' : prCfg.dot}`} />
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: prCfg.bg }}>
                        <TypeIcon size={14} style={{ color: prCfg.color }} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-[#0F172A]">{alert.message}</p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: prCfg.color, background: prCfg.bg }}>
                          {alert.priorite}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] font-mono text-[#94A3B8]">{alert.product_sku}</span>
                        <span className="text-[11px] text-[#64748B]">
                          {t('stock.alertes.colQty')}: <strong style={{ color: prCfg.color }}>{alert.stock_actuel} {alert.product_unite}</strong>
                        </span>
                        <span className="text-[11px] text-[#94A3B8]">{t('stock.alertes.colSeuil')}: {alert.seuil}</span>
                      </div>
                    </div>
                    {!alert.lue && (
                      <button onClick={() => markLue(alert.id)}
                        className="p-1.5 rounded-lg hover:bg-[#F0FDF4] text-[#94A3B8] hover:text-[#16A34A] transition-colors shrink-0">
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        /* Config tab */
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#0F172A] mb-5">Configuration des alertes stocks</h3>
          <div className="space-y-5 max-w-lg">
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Seuil de stock faible global (unités)
              </label>
              <p className="text-[11px] text-[#94A3B8] mb-2">Appliqué aux produits sans seuil d'alerte individuel</p>
              <input type="number" min={0} value={config.seuil_stock_faible_global}
                onChange={e => setConfig(c => ({ ...c, seuil_stock_faible_global: Number(e.target.value) }))}
                className="w-40 px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
            </div>

            {[
              { key: 'notif_rupture', label: 'Alertes rupture de stock', desc: 'Notifier quand stock = 0' },
              { key: 'notif_stock_faible', label: 'Alertes stock faible', desc: 'Notifier quand stock ≤ seuil d\'alerte' },
              { key: 'notif_surplus', label: 'Alertes surplus', desc: 'Notifier quand stock ≥ stock max' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-[#F1F5F9]">
                <div>
                  <p className="text-xs font-semibold text-[#0F172A]">{item.label}</p>
                  <p className="text-[11px] text-[#94A3B8]">{item.desc}</p>
                </div>
                <div
                  onClick={() => setConfig(c => ({ ...c, [item.key]: !c[item.key as keyof AlertConfig] }))}
                  className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                    config[item.key as keyof AlertConfig] ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'
                  }`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    config[item.key as keyof AlertConfig] ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </div>
              </div>
            ))}

            <button onClick={load}
              className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
              <RefreshCw size={13} />
              Appliquer et recalculer les alertes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
