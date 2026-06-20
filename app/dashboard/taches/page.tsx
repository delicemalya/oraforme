'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  Plus, X, ChevronRight, MessageSquare, User,
  Calendar, Flag, Tag, Clock, CheckCircle2,
  AlertTriangle, Circle, Loader2, Trash2, Send,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type Statut    = 'todo' | 'en_cours' | 'en_attente' | 'termine'
type Priorite  = 'basse' | 'normale' | 'haute' | 'urgente'

interface Task {
  id:           string
  title:        string
  description:  string | null
  statut:       Statut
  priorite:     Priorite
  due_date:     string | null
  assigned_to:  string | null
  created_by:   string | null
  tags:         string[]
  ordre:        number
  created_at:   string
  comment_count?: number
}

interface Comment {
  id:         string
  content:    string
  user_email: string | null
  created_at: string
}

interface Member {
  user_id: string
  email:   string
  role:    string
}

// ── Config colonnes Kanban ────────────────────────────────────────────────────

const COLUMNS: { id: Statut; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'todo',        label: 'À faire',      color: '#64748B', bg: '#F8FAFC', icon: <Circle      size={14} /> },
  { id: 'en_cours',    label: 'En cours',     color: '#2563EB', bg: '#EFF6FF', icon: <Loader2     size={14} /> },
  { id: 'en_attente',  label: 'En attente',   color: '#D97706', bg: '#FFFBEB', icon: <Clock       size={14} /> },
  { id: 'termine',     label: 'Terminé',      color: '#16A34A', bg: '#F0FDF4', icon: <CheckCircle2 size={14} /> },
]

const PRIORITE_CONFIG: Record<Priorite, { label: string; color: string; bg: string }> = {
  basse:    { label: 'Basse',    color: '#64748B', bg: '#F1F5F9' },
  normale:  { label: 'Normale',  color: '#2563EB', bg: '#EFF6FF' },
  haute:    { label: 'Haute',    color: '#D97706', bg: '#FFFBEB' },
  urgente:  { label: 'Urgente',  color: '#DC2626', bg: '#FEF2F2' },
}

// ── Blank forms ────────────────────────────────────────────────────────────────

const BLANK_TASK = { title: '', description: '', priorite: 'normale' as Priorite, due_date: '', assigned_to: '', tags: '' }

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function isOverdue(due: string | null): boolean {
  if (!due) return false
  return new Date(due) < new Date(new Date().toDateString())
}

// ── Priority Badge ─────────────────────────────────────────────────────────────

function PrioriteBadge({ p }: { p: Priorite }) {
  const cfg = PRIORITE_CONFIG[p]
  return (
    <span style={{ background: cfg.bg, color: cfg.color }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold">
      <Flag size={9} />
      {cfg.label}
    </span>
  )
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task.due_date) && task.statut !== 'termine'
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-[#E5E7EB] p-3 cursor-pointer hover:shadow-md hover:border-[#DC2626]/30 transition-all group"
    >
      <p className="text-sm font-medium text-[#0F172A] leading-snug group-hover:text-[#DC2626] transition-colors line-clamp-2">
        {task.title}
      </p>

      {task.description && (
        <p className="text-xs text-[#94A3B8] mt-1 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <PrioriteBadge p={task.priorite} />

        {task.due_date && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${overdue ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>
            <Calendar size={9} />
            {fmtDate(task.due_date)}
            {overdue && <AlertTriangle size={9} />}
          </span>
        )}

        {task.tags.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]">
            <Tag size={9} />
            {task.tags.slice(0, 2).join(', ')}
          </span>
        )}
      </div>

      {(task.comment_count ?? 0) > 0 && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-[#94A3B8]">
          <MessageSquare size={10} />
          {task.comment_count} commentaire{(task.comment_count ?? 0) > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

// ── Inline Add Row ─────────────────────────────────────────────────────────────

function InlineAdd({ statut, tenantId, onAdded }: { statut: Statut; tenantId: string; onAdded: () => void }) {
  const { t } = useLocale()
  const [open,  setOpen]  = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    await supabase.from('tasks').insert({ tenant_id: tenantId, title: title.trim(), statut })
    setTitle(''); setOpen(false); setSaving(false); onAdded()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#DC2626] py-1.5 px-2 rounded-lg hover:bg-[#FEF2F2] transition-colors mt-1">
        <Plus size={13} /> Ajouter une tâche
      </button>
    )
  }

  return (
    <div className="mt-2 bg-white rounded-xl border border-[#DC2626]/40 p-2 shadow-sm">
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false) }}
        placeholder="Titre de la tâche..."
        className="w-full text-sm outline-none text-[#0F172A] placeholder-[#94A3B8]"
      />
      <div className="flex gap-1.5 mt-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-xs text-[#94A3B8] hover:text-[#0F172A] px-2 py-1">{t('common.cancel')}</button>
        <button onClick={save} disabled={saving || !title.trim()}
          className="text-xs bg-[#DC2626] text-white px-3 py-1 rounded-lg disabled:opacity-50 font-medium">
          {saving ? 'Ajout...' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

// ── Task Detail Panel ─────────────────────────────────────────────────────────

function TaskDetailPanel({
  task, members, tenantId, onClose, onRefresh,
}: {
  task: Task
  members: Member[]
  tenantId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const { t } = useLocale()
  const [form, setForm]         = useState({ ...BLANK_TASK, ...task, tags: task.tags.join(', '), due_date: task.due_date ?? '' })
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [posting, setPosting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.from('task_comments')
      .select('*').eq('task_id', task.id).order('created_at')
      .then(({ data }) => setComments(data ?? []))
  }, [task.id])

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('tasks').update({
      title:       form.title,
      description: form.description || null,
      statut:      form.statut as Statut,
      priorite:    form.priorite as Priorite,
      due_date:    form.due_date || null,
      assigned_to: form.assigned_to || null,
      tags:        form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    }).eq('id', task.id)
    setSaving(false)
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm('Supprimer cette tâche ?')) return
    setDeleting(true)
    await supabase.from('tasks').update({ statut: 'annule' }).eq('id', task.id)
    setDeleting(false)
    onClose(); onRefresh()
  }

  async function postComment() {
    if (!newComment.trim()) return
    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('task_comments').insert({
      tenant_id:  tenantId,
      task_id:    task.id,
      content:    newComment.trim(),
      user_id:    user?.id ?? null,
      user_email: user?.email ?? null,
    })
    setNewComment('')
    const { data } = await supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at')
    setComments(data ?? [])
    setPosting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-[#0F172A]">Détail de la tâche</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="text-[#DC2626] hover:bg-[#FEF2F2] p-1.5 rounded-lg transition-colors">
              <Trash2 size={15} />
            </button>
            <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Titre */}
          <div>
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Titre</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full mt-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">{t('common.description')}</label>
            <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={3}
              className="w-full mt-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 resize-none" />
          </div>

          {/* Statut + Priorité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">{t('common.status')}</label>
              <select value={form.statut} onChange={e => set('statut', e.target.value as Statut)}
                className="w-full mt-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 bg-white">
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Priorité</label>
              <select value={form.priorite} onChange={e => set('priorite', e.target.value as Priorite)}
                className="w-full mt-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 bg-white">
                {(Object.keys(PRIORITE_CONFIG) as Priorite[]).map(p => (
                  <option key={p} value={p}>{PRIORITE_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Échéance + Assigné */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Échéance</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full mt-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Assigné à</label>
              <select value={form.assigned_to ?? ''} onChange={e => set('assigned_to', e.target.value)}
                className="w-full mt-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 bg-white">
                <option value="">— Non assigné</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Tags (virgule)</label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="ex: urgent, client, dev"
              className="w-full mt-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30" />
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-[#DC2626] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#B91C1C] disabled:opacity-60 transition-colors">
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>

          {/* Comments */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <MessageSquare size={12} /> Commentaires ({comments.length})
            </h3>

            {comments.length === 0 && (
              <p className="text-xs text-[#94A3B8] text-center py-3">Aucun commentaire</p>
            )}

            <div className="space-y-2 mb-3">
              {comments.map(c => (
                <div key={c.id} className="bg-[#F8FAFC] rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <User size={10} className="text-[#94A3B8]" />
                    <span className="text-[10px] font-medium text-[#64748B]">{c.user_email ?? 'Anonyme'}</span>
                    <span className="text-[10px] text-[#94A3B8] ml-auto">{fmtDate(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-[#0F172A]">{c.content}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && postComment()}
                placeholder="Ajouter un commentaire..."
                className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30"
              />
              <button onClick={postComment} disabled={posting || !newComment.trim()}
                className="bg-[#DC2626] text-white rounded-lg px-3 py-2 disabled:opacity-50 hover:bg-[#B91C1C] transition-colors">
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function TachesPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [tasks,   setTasks]   = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Task | null>(null)
  const [filterPriorite, setFilterPriorite] = useState<Priorite | 'all'>('all')

  const load = useCallback(async () => {
    if (!tenantId) return
    const [{ data: tasksData }, { data: membersData }] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, task_comments(count)')
        .eq('tenant_id', tenantId)
        .not('statut', 'eq', 'annule')
        .order('ordre')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('user_id, email, role')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
        .limit(50),
    ])

    const processed = (tasksData ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      comment_count: Array.isArray(t.task_comments)
        ? (t.task_comments[0] as { count: number })?.count ?? 0
        : 0,
    })) as Task[]

    setTasks(processed)
    setMembers(membersData ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return
    const channel = supabase
      .channel(`tasks:${tenantId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenantId, load])

  const filteredTasks = filterPriorite === 'all'
    ? tasks
    : tasks.filter(t => t.priorite === filterPriorite)

  // KPIs
  const todo     = tasks.filter(t => t.statut === 'todo').length
  const enCours  = tasks.filter(t => t.statut === 'en_cours').length
  const urgentes = tasks.filter(t => t.priorite === 'urgente' && t.statut !== 'termine').length
  const terminees = tasks.filter(t => t.statut === 'termine').length

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Tâches & Collaboration</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Kanban board · Suivi temps réel</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'À faire',   value: todo,      color: '#64748B', bg: '#F8FAFC' },
          { label: 'En cours',  value: enCours,   color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Urgentes',  value: urgentes,  color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Terminées', value: terminees, color: '#16A34A', bg: '#F0FDF4' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#94A3B8] font-medium">{k.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtres priorité */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-[#94A3B8] font-medium">Priorité :</span>
        {(['all', 'urgente', 'haute', 'normale', 'basse'] as const).map(p => (
          <button key={p} onClick={() => setFilterPriorite(p)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              filterPriorite === p
                ? 'bg-[#DC2626] text-white border-[#DC2626]'
                : 'bg-white text-[#64748B] border-[#E5E7EB] hover:border-[#DC2626]/40'
            }`}>
            {p === 'all' ? 'Toutes' : PRIORITE_CONFIG[p].label}
          </button>
        ))}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.statut === col.id)
          return (
            <div key={col.id} className="flex flex-col rounded-2xl overflow-hidden border border-[#E5E7EB]">
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5" style={{ background: col.bg, borderBottom: `2px solid ${col.color}20` }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: col.color }}>{col.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: col.color }}>{col.label}</span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white" style={{ color: col.color }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 min-h-[120px]" style={{ background: col.bg }}>
                {colTasks.length === 0 && (
                  <p className="text-center text-xs text-[#94A3B8] py-6">Aucune tâche</p>
                )}
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} onClick={() => setSelected(task)} />
                ))}
                {tenantId && col.id !== 'termine' && (
                  <InlineAdd statut={col.id} tenantId={tenantId} onAdded={load} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Task detail side panel */}
      {selected && tenantId && (
        <TaskDetailPanel
          task={selected}
          members={members}
          tenantId={tenantId}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(); setSelected(null) }}
        />
      )}

      {/* Quick stats */}
      {tasks.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-[#E5E7EB] p-4">
          <h2 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
            <ChevronRight size={14} className="text-[#DC2626]" />
            Répartition par priorité
          </h2>
          <div className="flex gap-3 flex-wrap">
            {(Object.keys(PRIORITE_CONFIG) as Priorite[]).map(p => {
              const count = tasks.filter(t => t.priorite === p && t.statut !== 'termine').length
              const cfg   = PRIORITE_CONFIG[p]
              if (count === 0) return null
              return (
                <div key={p} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC]">
                  <Flag size={11} style={{ color: cfg.color }} />
                  <span className="text-xs font-medium text-[#0F172A]">{cfg.label}</span>
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
