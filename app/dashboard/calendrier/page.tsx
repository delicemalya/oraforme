'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2,
  Calendar, Clock, MapPin, Users,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string
  title: string
  description?: string
  type: EventType
  statut: string
  start_date: string
  end_date?: string
  all_day: boolean
  location?: string
  color: string
  created_at: string
}

type EventType = 'event' | 'reunion' | 'deadline' | 'examen' | 'paiement' | 'conge' | 'tache' | 'rappel' | 'formation'
type CalView   = 'month' | 'week'

// ── Config ─────────────────────────────────────────────────────────────────────

const EVENT_TYPES: Record<EventType, { label: string; color: string; bg: string }> = {
  event:     { label: 'Événement',  color: '#2563EB', bg: '#EFF6FF' },
  reunion:   { label: 'Réunion',    color: '#7C3AED', bg: '#F5F3FF' },
  deadline:  { label: 'Deadline',   color: '#DC2626', bg: '#FEF2F2' },
  examen:    { label: 'Examen',     color: '#D97706', bg: '#FFFBEB' },
  paiement:  { label: 'Paiement',   color: '#059669', bg: '#F0FDF4' },
  conge:     { label: 'Congé',      color: '#0891B2', bg: '#ECFEFF' },
  tache:     { label: 'Tâche',      color: '#64748B', bg: '#F8FAFC' },
  rappel:    { label: 'Rappel',     color: '#F59E0B', bg: '#FFFBEB' },
  formation: { label: 'Formation',  color: '#8B5CF6', bg: '#F5F3FF' },
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

// ── Calendar helpers ───────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Mon=0 … Sun=6
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth() &&
         a.getDate()     === b.getDate()
}

function fmtDateTime(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── EventModal ────────────────────────────────────────────────────────────────

interface EventModalProps {
  date?: Date
  event?: CalEvent | null
  tenantId: string
  onClose: () => void
  onSaved: () => void
}

function EventModal({ date, event, tenantId, onClose, onSaved }: EventModalProps) {
  const { t } = useLocale()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title:       event?.title       ?? '',
    description: event?.description ?? '',
    type:        (event?.type       ?? 'event') as EventType,
    start_date:  event?.start_date
      ? new Date(event.start_date).toISOString().slice(0, 16)
      : date ? `${date.toISOString().slice(0, 10)}T09:00` : '',
    end_date: event?.end_date
      ? new Date(event.end_date).toISOString().slice(0, 16)
      : date ? `${date.toISOString().slice(0, 10)}T10:00` : '',
    all_day:  event?.all_day  ?? false,
    location: event?.location ?? '',
    color:    event?.color    ?? '#2563EB',
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      tenant_id:   tenantId,
      title:       form.title.trim(),
      description: form.description.trim() || null,
      type:        form.type,
      start_date:  form.start_date,
      end_date:    form.end_date || null,
      all_day:     form.all_day,
      location:    form.location.trim() || null,
      color:       EVENT_TYPES[form.type].color,
    }
    if (event?.id) {
      await supabase.from('events').update(payload).eq('id', event.id)
    } else {
      await supabase.from('events').insert(payload)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!event?.id || !confirm('Supprimer cet événement ?')) return
    await supabase.from('events').delete().eq('id', event.id)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="text-[15px] font-bold text-[#0F172A] flex items-center gap-2">
            <Calendar size={16} className="text-[#DC2626]" />
            {event ? 'Modifier l\'événement' : 'Nouvel événement'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-3">
          {/* Title */}
          <div>
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Titre *</label>
            <input required value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Réunion mensuelle, Deadline projet..."
              className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30" />
          </div>

          {/* Type */}
          <div>
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('common.type')}</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {(Object.keys(EVENT_TYPES) as EventType[]).map(tp => (
                <button key={tp} type="button" onClick={() => set('type', tp)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                  style={form.type === tp
                    ? { background: EVENT_TYPES[tp].color, color: '#fff' }
                    : { background: EVENT_TYPES[tp].bg, color: EVENT_TYPES[tp].color }}>
                  {EVENT_TYPES[tp].label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Début *</label>
              <input required type={form.all_day ? 'date' : 'datetime-local'}
                value={form.all_day ? form.start_date.slice(0, 10) : form.start_date}
                onChange={e => set('start_date', e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Fin</label>
              <input type={form.all_day ? 'date' : 'datetime-local'}
                value={form.all_day ? form.end_date.slice(0, 10) : form.end_date}
                onChange={e => set('end_date', e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
            </div>
          </div>

          {/* All day */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.all_day} onChange={e => set('all_day', e.target.checked)}
              className="w-4 h-4 accent-[#DC2626]" />
            <span className="text-[12px] text-[#64748B]">Journée entière</span>
          </label>

          {/* Location */}
          <div>
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide flex items-center gap-1">
              <MapPin size={11} /> Lieu
            </label>
            <input value={form.location} onChange={e => set('location', e.target.value)}
              placeholder="Salle de conférence, Zoom, Brazzaville..."
              className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{t('common.description')}</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none resize-none" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {event && (
              <button type="button" onClick={handleDelete}
                className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-[13px] font-semibold hover:bg-red-50">
                Supprimer
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-[#DC2626] text-white rounded-xl text-[13px] font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {event ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── EventDetailPanel ──────────────────────────────────────────────────────────

function EventDetailPanel({
  event, onClose, onEdit,
}: { event: CalEvent; onClose: () => void; onEdit: () => void }) {
  const cfg = EVENT_TYPES[event.type]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[11px] font-bold px-2 py-1 rounded-lg"
            style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
            <X size={16} />
          </button>
        </div>
        <h3 className="text-[16px] font-bold text-[#0F172A] mb-3">{event.title}</h3>
        <div className="space-y-2 text-[12px] text-[#64748B]">
          <div className="flex items-center gap-2">
            <Clock size={13} className="shrink-0" />
            <span>{fmtDateTime(event.start_date)}{event.end_date ? ` → ${fmtDateTime(event.end_date)}` : ''}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin size={13} className="shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
          {event.description && (
            <p className="mt-2 text-[12px] text-[#475569] bg-[#F8FAFC] rounded-xl p-3 leading-relaxed">
              {event.description}
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose}
            className="flex-1 py-2 border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            Fermer
          </button>
          <button onClick={onEdit}
            className="flex-1 py-2 bg-[#DC2626] text-white rounded-xl text-[12px] font-semibold hover:bg-red-700">
            Modifier
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CalendrierPage ────────────────────────────────────────────────────────────

export default function CalendrierPage() {
  const { t } = useLocale()
  const { tenantId } = useTenant()

  const today    = new Date()
  const [year,   setYear]   = useState(today.getFullYear())
  const [month,  setMonth]  = useState(today.getMonth())
  const [view,   setView]   = useState<CalView>('month')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all')

  const [showModal,  setShowModal]  = useState(false)
  const [modalDate,  setModalDate]  = useState<Date | undefined>()
  const [editEvent,  setEditEvent]  = useState<CalEvent | null>(null)
  const [detailEvt,  setDetailEvt]  = useState<CalEvent | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const from = new Date(year, month, 1).toISOString()
    const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('start_date', from)
      .lte('start_date', to)
      .neq('statut', 'annule')
      .order('start_date')
    setEvents((data ?? []) as CalEvent[])
    setLoading(false)
  }, [tenantId, year, month])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Build month grid
  const firstDay  = getFirstDayOfMonth(year, month)
  const daysCount = getDaysInMonth(year, month)
  const totalCells = Math.ceil((firstDay + daysCount) / 7) * 7
  const cells: Array<Date | null> = Array.from({ length: totalCells }, (_, i) => {
    const d = i - firstDay + 1
    if (d < 1 || d > daysCount) return null
    return new Date(year, month, d)
  })

  const filteredEvents = typeFilter === 'all'
    ? events
    : events.filter(e => e.type === typeFilter)

  function eventsForDay(date: Date) {
    return filteredEvents.filter(e => isSameDay(new Date(e.start_date), date))
  }

  function openAddModal(date: Date) {
    setModalDate(date); setEditEvent(null); setShowModal(true)
  }

  function openEditModal(e: CalEvent) {
    setEditEvent(e); setModalDate(undefined); setDetailEvt(null); setShowModal(true)
  }

  // Month stats
  const totalThisMonth  = events.length
  const deadlines       = events.filter(e => e.type === 'deadline').length
  const reunions        = events.filter(e => e.type === 'reunion').length
  const todayEvents     = events.filter(e => isSameDay(new Date(e.start_date), today))

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center shrink-0">
          <Calendar size={20} className="text-[#DC2626]" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-[#0F172A]">Calendrier Global</h1>
          <p className="text-[11px] text-[#64748B]">Événements, réunions, deadlines et planification</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-[#E5E7EB] rounded-xl overflow-hidden">
            {(['month', 'week'] as CalView[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-2 text-[12px] font-semibold transition-colors ${view === v ? 'bg-[#DC2626] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
                {v === 'month' ? 'Mois' : 'Semaine'}
              </button>
            ))}
          </div>
          <button onClick={() => { setModalDate(today); setEditEvent(null); setShowModal(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#DC2626] text-white text-[12px] font-semibold hover:bg-red-700 shadow-sm">
            <Plus size={13} />
            Événement
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ce mois',   value: totalThisMonth, color: '#DC2626', bg: '#FEF2F2' },
          { label: "Aujourd'hui", value: todayEvents.length, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Réunions',  value: reunions,       color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Deadlines', value: deadlines,      color: '#D97706', bg: '#FFFBEB' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Type filter chips ── */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${typeFilter === 'all' ? 'bg-[#DC2626] text-white' : 'border border-[#E5E7EB] text-[#64748B] hover:bg-[#F8FAFC]'}`}>
          Tous
        </button>
        {(Object.keys(EVENT_TYPES) as EventType[]).map(tp => (
          <button key={tp} onClick={() => setTypeFilter(tp)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors"
            style={typeFilter === tp
              ? { background: EVENT_TYPES[tp].color, color: '#fff' }
              : { background: EVENT_TYPES[tp].bg, color: EVENT_TYPES[tp].color, border: `1px solid ${EVENT_TYPES[tp].bg}` }}>
            {EVENT_TYPES[tp].label}
          </button>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">

        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#F1F5F9]">
          <button onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-[15px] font-bold text-[#0F172A]">
            {MONTHS_FR[month]} {year}
          </h2>
          <button onClick={nextMonth}
            className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#F1F5F9]">
          {DAYS_FR.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#94A3B8]" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="min-h-[100px] bg-[#FAFAFA] border-b border-r border-[#F8FAFC]" />
              }
              const dayEvents = eventsForDay(date)
              const isToday   = isSameDay(date, today)
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              return (
                <div
                  key={date.toISOString()}
                  onClick={() => openAddModal(date)}
                  className={`min-h-[100px] p-1.5 border-b border-r border-[#F8FAFC] cursor-pointer transition-colors hover:bg-[#FEFEFE] group ${isWeekend ? 'bg-[#FAFAFA]' : ''}`}
                >
                  {/* Day number */}
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full text-[12px] font-semibold mb-1 transition-colors ${
                    isToday ? 'bg-[#DC2626] text-white' : 'text-[#0F172A] group-hover:bg-[#F1F5F9]'
                  }`}>
                    {date.getDate()}
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => {
                      const cfg = EVENT_TYPES[ev.type]
                      return (
                        <div
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); setDetailEvt(ev) }}
                          className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {ev.title}
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-[#94A3B8] pl-1">+{dayEvents.length - 3} autres</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Events list for current month ── */}
      {filteredEvents.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
            <Calendar size={13} className="text-[#94A3B8]" />
            <span className="text-[12px] font-semibold text-[#0F172A]">
              Événements — {MONTHS_FR[month]} {year}
            </span>
            <span className="ml-auto text-[11px] text-[#94A3B8]">{filteredEvents.length} événement(s)</span>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {filteredEvents.map(ev => {
              const cfg = EVENT_TYPES[ev.type]
              const d   = new Date(ev.start_date)
              return (
                <div key={ev.id}
                  onClick={() => setDetailEvt(ev)}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAFAFA] transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0"
                    style={{ background: cfg.bg }}>
                    <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                      {MONTHS_FR[d.getMonth()].slice(0, 3).toUpperCase()}
                    </span>
                    <span className="text-[14px] font-bold" style={{ color: cfg.color }}>
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">{ev.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {ev.location && <span className="text-[10px] text-[#94A3B8] flex items-center gap-0.5"><MapPin size={9} />{ev.location}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showModal && tenantId && (
        <EventModal
          date={modalDate}
          event={editEvent}
          tenantId={tenantId}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}

      {detailEvt && (
        <EventDetailPanel
          event={detailEvt}
          onClose={() => setDetailEvt(null)}
          onEdit={() => openEditModal(detailEvt)}
        />
      )}
    </div>
  )
}
