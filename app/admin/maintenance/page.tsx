'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState } from 'react'
import { Wrench, AlertTriangle, CheckCircle2, Clock, Zap, Shield, RefreshCw, Database, Globe, Power } from 'lucide-react'

export default function MaintenancePage() {
  const { t } = useLocale()
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const tasks = [
    { id: 1, label: 'Vider le cache Next.js',           status: 'idle',    risk: 'low',    duration: '< 5s'  },
    { id: 2, label: 'Recharger les connexions DB',       status: 'idle',    risk: 'medium', duration: '~30s'  },
    { id: 3, label: 'Vérifier les indexes PostgreSQL',   status: 'idle',    risk: 'low',    duration: '~60s'  },
    { id: 4, label: 'Analyser les tables VACUUM',        status: 'idle',    risk: 'low',    duration: '~2 min'},
    { id: 5, label: 'Regénérer les policies RLS',        status: 'idle',    risk: 'high',   duration: '~5s'   },
    { id: 6, label: 'Purger les sessions expirées',      status: 'idle',    risk: 'low',    duration: '~10s'  },
    { id: 7, label: 'Vérifier les triggers OHADA',       status: 'idle',    risk: 'low',    duration: '~5s'   },
    { id: 8, label: 'Compresser les logs anciens',       status: 'idle',    risk: 'low',    duration: '~30s'  },
  ]

  const announcements = [
    { id: 1, title: 'Mise à jour modules v2.1',   date: '2026-06-01',  status: 'planned',  desc: 'Amélioration module Trésorerie + nouveaux rapports OHADA'     },
    { id: 2, title: 'Migration PostgreSQL 17',    date: '2026-06-15',  status: 'planned',  desc: 'Mise à jour moteur base de données (downtime ~15 min)'         },
    { id: 3, title: 'MIAA+ Claude 4 Upgrade',     date: '2026-05-30',  status: 'soon',     desc: 'Passage au modèle Claude Haiku 4.5 avec mémoire contextuelle'  },
    { id: 4, title: 'Déploiement Airtel Money',   date: '2026-07-01',  status: 'planned',  desc: 'Intégration paiement Mobile Money Congo-Brazzaville'           },
  ]

  const RISK_CFG: Record<string, string> = {
    low:    'bg-green-50 text-green-700 border-green-200',
    medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    high:   'bg-red-50 text-red-600 border-red-200',
  }

  const ANN_CFG: Record<string, { cls: string; label: string }> = {
    planned: { cls: 'bg-blue-50 text-blue-700 border-blue-200',   label: 'Planifié'  },
    soon:    { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Bientôt'  },
    done:    { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Terminé'  },
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Maintenance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Outils d&apos;administration et planification</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${maintenanceMode ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          {maintenanceMode
            ? <><AlertTriangle size={14} className="text-red-500" /><span className="text-[13px] font-bold text-red-700">Mode maintenance ACTIF</span></>
            : <><CheckCircle2 size={14} className="text-green-600" /><span className="text-[13px] font-bold text-green-700">Plateforme opérationnelle</span></>}
        </div>
      </div>

      {/* Maintenance mode toggle */}
      <div className={`rounded-2xl border p-6 shadow-sm ${maintenanceMode ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${maintenanceMode ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Power size={18} className={maintenanceMode ? 'text-red-600' : 'text-gray-500'} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Mode Maintenance Global</h2>
              <p className="text-[12px] text-gray-500 mt-1 max-w-lg">
                Active une page de maintenance pour <strong>tous les tenants clients</strong>. Le panneau /admin reste accessible pour les Super Owners. À utiliser uniquement pour les mises à jour critiques.
              </p>
              {maintenanceMode && (
                <div className="mt-2 px-3 py-1.5 rounded-lg bg-red-100 border border-red-200 inline-block">
                  <p className="text-[12px] font-semibold text-red-700">⚠️ Tous les clients voient une page de maintenance</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            {!confirming && !maintenanceMode && (
              <button
                onClick={() => setConfirming(true)}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 transition-colors"
              >
                Activer maintenance
              </button>
            )}
            {confirming && !maintenanceMode && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-red-700 font-semibold">Confirmer ?</span>
                <button
                  onClick={() => { setMaintenanceMode(true); setConfirming(false) }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold"
                >Oui, activer</button>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-[11px] font-bold"
                >{t('common.cancel')}</button>
              </div>
            )}
            {maintenanceMode && (
              <button
                onClick={() => setMaintenanceMode(false)}
                className="px-4 py-2 rounded-xl bg-green-500 text-white text-[12px] font-semibold hover:bg-green-600 transition-colors"
              >
                Désactiver maintenance
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance tasks */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center">
            <Wrench size={13} className="text-amber-600" />
          </div>
          <h2 className="text-[14px] font-bold text-gray-900">Tâches de maintenance</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900">{task.label}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${RISK_CFG[task.risk]}`}>
                    {task.risk === 'low' ? 'Risque faible' : task.risk === 'medium' ? 'Risque moyen' : 'Risque élevé'}
                  </span>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Clock size={10} /> {task.duration}
                  </span>
                </div>
              </div>
              <button className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-[12px] font-semibold hover:bg-gray-200 transition-colors flex items-center gap-1.5">
                <RefreshCw size={11} /> Exécuter
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Planned announcements */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Mises à jour planifiées</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {announcements.map(ann => {
            const cfg = ANN_CFG[ann.status]
            return (
              <div key={ann.id} className="flex items-start gap-4 px-6 py-4">
                <div className="w-12 text-center flex-shrink-0">
                  <p className="text-[11px] font-bold text-gray-400">
                    {new Date(ann.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </p>
                  <p className="text-[11px] text-gray-300">
                    {new Date(ann.date).getFullYear()}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[13px] font-bold text-gray-900">{ann.title}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                  <p className="text-[12px] text-gray-500">{ann.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* System checks */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-[15px] font-bold text-gray-900 mb-4">Checks système automatiques</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: 'RLS activé sur toutes les tables',     ok: true,  icon: Shield  },
            { label: 'Triggers OHADA opérationnels (11/11)', ok: true,  icon: Zap     },
            { label: 'Index FK en place',                    ok: true,  icon: Database},
            { label: 'Connexion Supabase stable',            ok: true,  icon: Globe   },
            { label: 'Clés API Anthropic valides',           ok: true,  icon: Zap     },
            { label: 'PITR activé (Supabase Pro)',           ok: false, icon: Clock   },
            { label: 'Monitoring alertes configurées',       ok: false, icon: AlertTriangle },
            { label: 'CDN Vercel opérationnel',              ok: true,  icon: Globe   },
          ].map((c, i) => {
            const Icon = c.icon
            return (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${c.ok ? 'bg-green-50/50 border-green-100' : 'bg-yellow-50/50 border-yellow-100'}`}>
                <Icon size={13} className={c.ok ? 'text-green-600' : 'text-yellow-600'} />
                <span className="text-[12px] text-gray-700 flex-1">{c.label}</span>
                {c.ok
                  ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                  : <AlertTriangle size={13} className="text-yellow-500 flex-shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
