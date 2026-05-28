'use client'

/**
 * Contrats — Module RH
 * Gestion des contrats : CDI, CDD, stage, vacation, prestataire.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { FileText, Plus, AlertTriangle, CheckCircle, Clock, X, Check, Download, Eye } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type TypeContrat = 'cdi' | 'cdd' | 'stage' | 'vacation' | 'freelance' | 'prestataire'

interface Contrat {
  id:               string
  employe_id:       string
  type:             TypeContrat
  date_debut:       string
  date_fin?:        string
  salaire_brut:     number
  poste:            string
  departement?:     string
  statut:           'actif' | 'expire' | 'resilie' | 'suspendu'
  motif_resiliation?: string
  created_at:       string
  employes?:        { nom: string; email: string }
}

interface Employe {
  id:   string
  nom:  string
  email: string
  poste: string
  contrat: TypeContrat
  date_embauche?: string
  date_fin_contrat?: string
  salaire_base: number
}

const TYPE_CONFIG: Record<TypeContrat, { label: string; color: string; bg: string }> = {
  cdi:         { label: 'CDI',         color: '#10B981', bg: '#D1FAE5' },
  cdd:         { label: 'CDD',         color: '#F59E0B', bg: '#FEF3C7' },
  stage:       { label: 'Stage',       color: '#3B82F6', bg: '#DBEAFE' },
  vacation:    { label: 'Vacation',    color: '#EC4899', bg: '#FCE7F3' },
  freelance:   { label: 'Freelance',   color: '#8B5CF6', bg: '#EDE9FE' },
  prestataire: { label: 'Prestataire', color: '#64748B', bg: '#F1F5F9' },
}

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }

function daysLeft(dateStr?: string) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function fmtDate(s?: string, undetermined?: string) {
  if (!s) return undetermined ?? 'Indéterminé'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ContratsPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [employes,  setEmployes]  = useState<Employe[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<string>('tous')
  const [selected,  setSelected]  = useState<Employe | null>(null)
  const [showNew,   setShowNew]   = useState(false)
  const [saving,    setSaving]    = useState(false)

  const [form, setForm] = useState({
    employe_id: '', type: 'cdi' as TypeContrat,
    date_debut: '', date_fin: '', salaire_brut: '',
    poste: '', departement: '', notes: '',
  })

  useEffect(() => {
    if (!tenantId) return
    load()
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('employes')
      .select('id, nom, email, poste, contrat, date_embauche, date_fin_contrat, salaire_base, statut')
      .eq('tenant_id', tenantId!)
      .order('nom')
    setEmployes((data ?? []) as Employe[])
    setLoading(false)
  }

  async function handleRenew(emp: Employe) {
    const newFin = new Date()
    newFin.setFullYear(newFin.getFullYear() + 1)
    await supabase.from('employes').update({
      date_fin_contrat: newFin.toISOString().slice(0, 10),
      statut: 'actif',
    }).eq('id', emp.id)
    load()
    setSelected(null)
  }

  async function handleTerminate(emp: Employe) {
    if (!confirm(`${t('rh.contrats.confirmTerminate')} ${emp.nom} ?`)) return
    await supabase.from('employes').update({
      statut: 'licencie',
      date_fin_contrat: new Date().toISOString().slice(0, 10),
    }).eq('id', emp.id)
    load()
    setSelected(null)
  }

  const filtered = employes.filter(e => {
    if (filter === 'tous') return true
    if (filter === 'expirant') {
      const r = daysLeft(e.date_fin_contrat)
      return r !== null && r >= 0 && r <= 30
    }
    if (filter === 'expire') {
      const r = daysLeft(e.date_fin_contrat)
      return r !== null && r < 0
    }
    return e.contrat === filter
  })

  const expiringCount = employes.filter(e => {
    const r = daysLeft(e.date_fin_contrat)
    return r !== null && r >= 0 && r <= 30
  }).length

  const expiredCount = employes.filter(e => {
    const r = daysLeft(e.date_fin_contrat)
    return r !== null && r < 0
  }).length

  function printContract(emp: Employe) {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>${t('rh.contrats.printTitle')} — ${emp.nom}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;max-width:700px;margin:40px auto;padding:0 30px}
h1{font-size:20px;font-weight:800;color:#F59E0B;margin-bottom:4px}
.meta{color:#888;font-size:11px;margin-bottom:24px}
.section{margin-bottom:16px}
.section h3{font-size:13px;font-weight:700;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:8px}
.row{display:flex;justify-content:space-between;padding:4px 0}
.label{color:#888}.value{font-weight:600}
.sign{margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
.sign-box{border-top:2px solid #111;padding-top:8px;text-align:center;font-size:11px}
</style></head><body>
<h1>${t('rh.contrats.printTitle')}</h1>
<p class="meta">Type: ${TYPE_CONFIG[emp.contrat]?.label ?? emp.contrat} · ${t('rh.contrats.generated')} ${new Date().toLocaleDateString('fr-FR')}</p>
<div class="section"><h3>${t('rh.contrats.printEmployee')}</h3>
<div class="row"><span class="label">${t('rh.contrats.printFullName')}</span><span class="value">${emp.nom}</span></div>
<div class="row"><span class="label">${t('rh.contrats.printEmail')}</span><span class="value">${emp.email || '—'}</span></div>
<div class="row"><span class="label">${t('rh.contrats.printPosition')}</span><span class="value">${emp.poste || '—'}</span></div>
</div>
<div class="section"><h3>${t('rh.contrats.printConditions')}</h3>
<div class="row"><span class="label">${t('rh.contrats.printContractType')}</span><span class="value">${TYPE_CONFIG[emp.contrat]?.label ?? emp.contrat}</span></div>
<div class="row"><span class="label">${t('rh.contrats.printHireDate')}</span><span class="value">${fmtDate(emp.date_embauche, t('rh.contrats.undetermined'))}</span></div>
<div class="row"><span class="label">${t('rh.contrats.printEndDate')}</span><span class="value">${fmtDate(emp.date_fin_contrat, t('rh.contrats.undetermined'))}</span></div>
<div class="row"><span class="label">${t('rh.contrats.printGrossSalary')}</span><span class="value">${fmt(emp.salaire_base)} FCFA</span></div>
</div>
<div class="sign">
<div class="sign-box">${t('rh.contrats.signEmployer')}<br/><br/>${t('rh.contrats.signDate')}</div>
<div class="sign-box">${t('rh.contrats.signEmployee')}<br/><br/>${t('rh.contrats.signDate')}</div>
</div>
</body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
            <FileText size={18} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">{t('rh.contrats.title')}</h1>
            <p className="text-[11px] text-[#64748B]">{employes.length} {t('rh.contrats.subtitle')} · {expiringCount} {t('rh.contrats.filterExpiring').toLowerCase()}</p>
          </div>
        </div>
      </div>

      {/* Alertes */}
      {(expiringCount > 0 || expiredCount > 0) && (
        <div className="space-y-2">
          {expiredCount > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              <p className="text-[13px] font-bold text-red-700">{expiredCount} {t('rh.contrats.filterExpired').toLowerCase()} — {t('rh.contrats.expired')}</p>
            </div>
          )}
          {expiringCount > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <Clock size={16} className="text-amber-600 shrink-0" />
              <p className="text-[13px] font-bold text-amber-700">{expiringCount} {t('rh.contrats.expiringSoon')}</p>
            </div>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { id: 'tous',     label: `${t('rh.contrats.filterAll')} (${employes.length})` },
          { id: 'cdi',      label: 'CDI' },
          { id: 'cdd',      label: 'CDD' },
          { id: 'stage',    label: 'Stage' },
          { id: 'vacation', label: 'Vacation' },
          { id: 'expirant', label: `${t('rh.contrats.filterExpiring')} (${expiringCount})`, alert: expiringCount > 0 },
          { id: 'expire',   label: `${t('rh.contrats.filterExpired')} (${expiredCount})`,   alert: expiredCount > 0 },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
              filter === f.id
                ? 'bg-[#F59E0B] text-white'
                : f.alert
                  ? 'border border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                  : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-[#F1F5F9] rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {[
                  t('rh.contrats.colEmployee'),
                  t('rh.contrats.colType'),
                  t('rh.contrats.colStart'),
                  t('rh.contrats.colEnd'),
                  t('rh.contrats.colSalary'),
                  t('rh.contrats.colStatus'),
                  t('rh.contrats.colActions'),
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filtered.map(emp => {
                const cfg   = TYPE_CONFIG[emp.contrat] ?? TYPE_CONFIG.cdi
                const days  = daysLeft(emp.date_fin_contrat)
                const isExp = days !== null && days < 0
                const isWarn= days !== null && days >= 0 && days <= 30
                return (
                  <tr key={emp.id} className="hover:bg-[#F8FAFC] transition-colors cursor-pointer" onClick={() => setSelected(emp)}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-[13px] font-semibold text-[#0F172A]">{emp.nom}</p>
                        <p className="text-[10px] text-[#94A3B8]">{emp.poste || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#64748B]">{fmtDate(emp.date_embauche, t('rh.contrats.undetermined'))}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className={`text-[12px] font-semibold ${isExp ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-[#0F172A]'}`}>
                          {fmtDate(emp.date_fin_contrat, t('rh.contrats.undetermined'))}
                        </p>
                        {days !== null && (
                          <p className={`text-[10px] ${isExp ? 'text-red-500' : isWarn ? 'text-amber-500' : 'text-[#94A3B8]'}`}>
                            {isExp
                              ? `${t('rh.contrats.expiredSince')} ${Math.abs(days)}${t('rh.contrats.days')}`
                              : `${t('rh.contrats.inDays')} ${days} ${t('rh.contrats.days')}`}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#0F172A]">{fmt(emp.salaire_base)} FCFA</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isExp ? 'bg-red-100 text-red-700' :
                        isWarn ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {isExp ? <><AlertTriangle size={9} />{t('rh.contrats.statusExpired')}</> :
                         isWarn ? <><Clock size={9} />{t('rh.contrats.statusExpireSoon')}</> :
                         <><CheckCircle size={9} />{t('rh.contrats.statusActive')}</>}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => printContract(emp)} title={t('rh.contrats.print')}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-[#94A3B8] hover:text-blue-600 transition-colors">
                          <Download size={13} />
                        </button>
                        <button onClick={() => setSelected(emp)} title={t('common.view') ?? 'Détails'}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-[#94A3B8] hover:text-amber-600 transition-colors">
                          <Eye size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[12px] text-[#94A3B8]">{t('rh.contrats.noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white border-l border-[#E2E8F0] z-50 overflow-y-auto shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-bold text-[#0F172A]">{selected.nom}</h2>
                  <p className="text-[12px] text-[#64748B]">{selected.poste}</p>
                </div>
                <button onClick={() => setSelected(null)}><X size={18} className="text-[#64748B]" /></button>
              </div>

              <div className="space-y-2">
                {[
                  [t('rh.contrats.detailType'),   TYPE_CONFIG[selected.contrat]?.label ?? selected.contrat],
                  [t('rh.contrats.detailStart'),   fmtDate(selected.date_embauche, t('rh.contrats.undetermined'))],
                  [t('rh.contrats.detailEnd'),     fmtDate(selected.date_fin_contrat, t('rh.contrats.undetermined'))],
                  [t('rh.contrats.detailSalary'),  `${fmt(selected.salaire_base)} FCFA`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between bg-[#F8FAFC] rounded-xl px-3 py-2">
                    <span className="text-[11px] text-[#64748B]">{k}</span>
                    <span className="text-[11px] font-semibold text-[#0F172A]">{v}</span>
                  </div>
                ))}
              </div>

              {daysLeft(selected.date_fin_contrat) !== null && (daysLeft(selected.date_fin_contrat)! <= 30) && (
                <div className={`rounded-xl p-3 ${daysLeft(selected.date_fin_contrat)! < 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <p className={`text-[12px] font-bold ${daysLeft(selected.date_fin_contrat)! < 0 ? 'text-red-700' : 'text-amber-700'}`}>
                    {daysLeft(selected.date_fin_contrat)! < 0
                      ? `${t('rh.contrats.expiredDays')} ${Math.abs(daysLeft(selected.date_fin_contrat)!)} ${t('rh.contrats.days')}`
                      : `${t('rh.contrats.expireInDays')} ${daysLeft(selected.date_fin_contrat)} ${t('rh.contrats.days')}`}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={() => handleRenew(selected)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-[12px] font-semibold hover:bg-green-100">
                  <Check size={13} /> {t('rh.contrats.renew')}
                </button>
                <button onClick={() => printContract(selected)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-[12px] font-semibold hover:bg-blue-100">
                  <Download size={13} /> {t('rh.contrats.print')}
                </button>
                <button onClick={() => handleTerminate(selected)}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100">
                  <X size={13} /> {t('rh.contrats.terminate')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
