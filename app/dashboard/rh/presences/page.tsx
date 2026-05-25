'use client'

/**
 * Présences & Pointage — Module RH
 * Gestion des présences, absences, retards, permissions.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  Clock, Check, X, Plus, AlertTriangle,
  CheckCircle, XCircle, Calendar, Users, Search,
  ArrowLeft, ArrowRight, Download,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type TypePresence = 'present' | 'absent' | 'retard' | 'permission' | 'teletravail'

interface Presence {
  id:          string
  employe_id:  string
  date:        string
  type:        TypePresence
  heure_arrivee?: string
  heure_depart?:  string
  motif?:      string
  created_at:  string
  employes?:   { nom: string; poste: string }
}

interface Employe {
  id:    string
  nom:   string
  poste: string
  statut: string
}

const TYPE_CONFIG: Record<TypePresence, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  present:    { label: 'Présent',      color: '#10B981', bg: '#D1FAE5', icon: <CheckCircle size={13} /> },
  absent:     { label: 'Absent',       color: '#EF4444', bg: '#FEE2E2', icon: <XCircle size={13} /> },
  retard:     { label: 'Retard',       color: '#F59E0B', bg: '#FEF3C7', icon: <AlertTriangle size={13} /> },
  permission: { label: 'Permission',   color: '#2563EB', bg: '#DBEAFE', icon: <Calendar size={13} /> },
  teletravail:{ label: 'Télétravail',  color: '#8B5CF6', bg: '#EDE9FE', icon: <Clock size={13} /> },
}

function fmt12(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function weekDays(anchor: Date): string[] {
  const days: string[] = []
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7))
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PresencesPage() {
  const { tenantId } = useTenant()
  const [presences, setPresences] = useState<Presence[]>([])
  const [employes,  setEmployes]  = useState<Employe[]>([])
  const [loading,   setLoading]   = useState(true)
  const [anchor,    setAnchor]    = useState(new Date())
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [search,    setSearch]    = useState('')
  const [view,      setView]      = useState<'day' | 'week'>('day')
  const [selDate,   setSelDate]   = useState(todayStr())

  const [form, setForm] = useState({
    employe_id: '', date: todayStr(), type: 'present' as TypePresence,
    heure_arrivee: '08:00', heure_depart: '17:00', motif: '',
  })

  useEffect(() => {
    if (!tenantId) return
    load()
  }, [tenantId, anchor]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const days = weekDays(anchor)
    const from = days[0]
    const to   = days[6]
    const [pRes, eRes] = await Promise.all([
      supabase
        .from('presences')
        .select('*, employes(nom, poste)')
        .eq('tenant_id', tenantId!)
        .gte('date', view === 'week' ? from : selDate)
        .lte('date', view === 'week' ? to   : selDate)
        .order('date', { ascending: false }),
      supabase
        .from('employes')
        .select('id, nom, poste, statut')
        .eq('tenant_id', tenantId!)
        .eq('statut', 'actif')
        .order('nom'),
    ])
    setPresences((pRes.data ?? []) as Presence[])
    setEmployes((eRes.data  ?? []) as Employe[])
    setLoading(false)
  }

  async function savePresence(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employe_id || !form.date) return
    setSaving(true)
    // Check for duplicate
    const { data: dup } = await supabase
      .from('presences')
      .select('id')
      .eq('tenant_id', tenantId!)
      .eq('employe_id', form.employe_id)
      .eq('date', form.date)
      .maybeSingle()

    if (dup) {
      await supabase.from('presences').update({
        type: form.type, heure_arrivee: form.heure_arrivee || null,
        heure_depart: form.heure_depart || null, motif: form.motif || null,
      }).eq('id', dup.id)
    } else {
      await supabase.from('presences').insert({
        tenant_id: tenantId!, employe_id: form.employe_id, date: form.date,
        type: form.type, heure_arrivee: form.heure_arrivee || null,
        heure_depart: form.heure_depart || null, motif: form.motif || null,
      })
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  // Quick toggle for today
  async function quickToggle(empId: string, type: TypePresence) {
    const existing = presences.find(p => p.employe_id === empId && p.date === selDate)
    if (existing) {
      await supabase.from('presences').update({ type }).eq('id', existing.id)
    } else {
      await supabase.from('presences').insert({
        tenant_id: tenantId!, employe_id: empId, date: selDate, type,
      })
    }
    load()
  }

  const days      = weekDays(anchor)
  const filtered  = employes.filter(e => !search || e.nom.toLowerCase().includes(search.toLowerCase()))

  // Stats for selected date
  const dayPresences = presences.filter(p => p.date === selDate)
  const presents  = dayPresences.filter(p => p.type === 'present' || p.type === 'teletravail').length
  const absents   = dayPresences.filter(p => p.type === 'absent').length
  const retards   = dayPresences.filter(p => p.type === 'retard').length

  function exportCSV() {
    const rows = [
      ['Date', 'Employé', 'Type', 'Arrivée', 'Départ', 'Motif'],
      ...presences.map(p => [
        p.date,
        (p.employes as unknown as { nom: string })?.nom ?? p.employe_id,
        TYPE_CONFIG[p.type]?.label ?? p.type,
        p.heure_arrivee ?? '',
        p.heure_depart  ?? '',
        p.motif         ?? '',
      ]),
    ]
    const csv  = '﻿' + rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `presences_${selDate}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
            <Clock size={18} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Présences & Pointage</h1>
            <p className="text-[11px] text-[#64748B]">{employes.length} employés actifs · {selDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] text-[#64748B] rounded-xl text-[12px] font-semibold hover:bg-[#F8FAFC]">
            <Download size={13} /> Exporter
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-amber-600 shadow-sm">
            <Plus size={13} /> Pointer
          </button>
        </div>
      </div>

      {/* Stats du jour */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Présents',  val: presents, color: '#10B981' },
          { label: 'Absents',   val: absents,  color: '#EF4444' },
          { label: 'Retards',   val: retards,  color: '#F59E0B' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm text-center">
            <p className="text-[28px] font-bold tabular-nums" style={{ color: k.color }}>{k.val}</p>
            <p className="text-[12px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Date navigation */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d) }}
            className="p-2 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC]">
            <ArrowLeft size={14} className="text-[#64748B]" />
          </button>
          <div className="flex-1 flex gap-1.5 overflow-x-auto">
            {days.map(day => {
              const isSelected = day === selDate
              const isToday    = day === todayStr()
              const dayLabel   = new Date(day).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
              const cnt        = presences.filter(p => p.date === day).length
              return (
                <button key={day} onClick={() => setSelDate(day)}
                  className={`flex-1 min-w-[60px] py-2 rounded-xl text-center transition-all ${
                    isSelected ? 'bg-[#F59E0B] text-white shadow-sm' :
                    isToday ? 'border-2 border-[#F59E0B] text-[#F59E0B]' :
                    'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}>
                  <p className="text-[10px] font-semibold">{dayLabel}</p>
                  {cnt > 0 && <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${isSelected ? 'bg-white' : 'bg-[#F59E0B]'}`} />}
                </button>
              )
            })}
          </div>
          <button onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d) }}
            className="p-2 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC]">
            <ArrowRight size={14} className="text-[#64748B]" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input type="text" placeholder="Rechercher un employé…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>

        {/* Employee list with quick toggle */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-[#F1F5F9] rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-[12px] text-[#94A3B8]">Aucun employé actif</div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(emp => {
              const pres = presences.find(p => p.employe_id === emp.id && p.date === selDate)
              const cfg  = pres ? (TYPE_CONFIG[pres.type] ?? TYPE_CONFIG.present) : null
              return (
                <div key={emp.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-[#F8FAFC] transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ background: '#7C3AED20', color: '#7C3AED' }}>
                    {emp.nom.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#0F172A] truncate">{emp.nom}</p>
                    <p className="text-[10px] text-[#94A3B8]">{emp.poste || '—'}</p>
                  </div>
                  {/* Quick status buttons */}
                  <div className="flex items-center gap-1">
                    {((['present', 'absent', 'retard', 'permission'] as TypePresence[])).map(t => {
                      const c = TYPE_CONFIG[t]
                      const isActive = pres?.type === t
                      return (
                        <button key={t} onClick={() => quickToggle(emp.id, t)}
                          title={c.label}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            isActive ? '' : 'opacity-30 hover:opacity-70'
                          }`}
                          style={isActive ? { backgroundColor: c.bg, color: c.color } : {}}>
                          {c.icon}
                        </button>
                      )
                    })}
                    {pres && (
                      <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ color: cfg!.color, backgroundColor: cfg!.bg }}>
                        {pres.heure_arrivee ? pres.heure_arrivee.slice(0, 5) : cfg!.label}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detailed table */}
      {presences.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-[#E2E8F0]">
            <h3 className="text-[13px] font-bold text-[#0F172A]">Pointages détaillés</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  {['Date', 'Employé', 'Statut', 'Arrivée', 'Départ', 'Motif'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {presences.map(p => {
                  const cfg = TYPE_CONFIG[p.type] ?? TYPE_CONFIG.present
                  return (
                    <tr key={p.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3 text-[12px] text-[#64748B]">{fmt12(p.date)}</td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-semibold text-[#0F172A]">
                          {(p.employes as unknown as { nom: string })?.nom ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: cfg.color, backgroundColor: cfg.bg }}>
                          {cfg.icon}{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#0F172A] font-mono">{p.heure_arrivee ?? '—'}</td>
                      <td className="px-4 py-3 text-[12px] text-[#0F172A] font-mono">{p.heure_depart ?? '—'}</td>
                      <td className="px-4 py-3 text-[11px] text-[#64748B]">{p.motif ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal pointage */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-[16px] font-bold text-[#0F172A] mb-5">Enregistrer une présence</h2>
            <form onSubmit={savePresence} className="space-y-3">
              <div>
                <label className={lCls}>Employé *</label>
                <select required value={form.employe_id} onChange={e => setForm(p => ({...p, employe_id: e.target.value}))} className={iCls}>
                  <option value="">Sélectionner…</option>
                  {employes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lCls}>Date *</label>
                  <input required type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Statut *</label>
                  <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value as TypePresence}))} className={iCls}>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                {(form.type === 'present' || form.type === 'retard' || form.type === 'teletravail') && (
                  <>
                    <div>
                      <label className={lCls}>Heure arrivée</label>
                      <input type="time" value={form.heure_arrivee} onChange={e => setForm(p => ({...p, heure_arrivee: e.target.value}))} className={iCls} />
                    </div>
                    <div>
                      <label className={lCls}>Heure départ</label>
                      <input type="time" value={form.heure_depart} onChange={e => setForm(p => ({...p, heure_depart: e.target.value}))} className={iCls} />
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className={lCls}>Motif (optionnel)</label>
                <input value={form.motif} onChange={e => setForm(p => ({...p, motif: e.target.value}))}
                  placeholder="Raison de l'absence, retard…" className={iCls} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold disabled:opacity-50 hover:bg-amber-600">
                  {saving ? '…' : <><Check size={14} /> Enregistrer</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const lCls = 'text-[10px] font-bold text-[#64748B] uppercase tracking-wide block mb-1'
const iCls = 'w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-[12px] text-[#0F172A] outline-none focus:ring-2 focus:ring-amber-300'
