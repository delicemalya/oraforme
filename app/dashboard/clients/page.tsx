'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Plus, Mail, Phone, MapPin, Trash2, Search,
  X, Loader2, UserPlus, TrendingUp, CheckCircle, ArrowUpRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'

interface Client {
  id: string
  nom: string
  email: string
  telephone: string
  adresse: string
  created_at: string
}

const AVATAR_COLORS = ['#DC2626', '#DC2626', '#0F172A', '#7C3AED', '#7C3AED', '#DC2626', '#0F172A', '#DC2626']
function avatarColor(nom: string) { return AVATAR_COLORS[nom.charCodeAt(0) % AVATAR_COLORS.length] }
function initials(nom: string) { return nom.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
function fadeUp(i: number) {
  return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: i * 0.06, ease: [0.23, 1, 0.32, 1] as const } }
}

function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-secondary)] font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-xl font-bold text-[var(--text)] leading-none">{value}</p>
        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function FormInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1.5 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B] focus:outline-none focus:border-[#DC2626]/60 transition-colors"
      />
    </div>
  )
}

export default function ClientsPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t } = useLocale()
  const [clients, setClients]   = useState<Client[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [search, setSearch]     = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [form, setForm] = useState({ nom: '', email: '', telephone: '', adresse: '' })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200)
    setClients((data ?? []) as Client[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }
  function setField(k: keyof typeof form, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSave() {
    if (!form.nom.trim() || !tenantId) return
    setSaving(true)
    const { error } = await supabase.from('clients').insert({
      tenant_id: tenantId, nom: form.nom, email: form.email,
      telephone: form.telephone, adresse: form.adresse,
    })
    setSaving(false)
    if (error) { showToast(t('clients.errorPrefix') + error.message); return }
    showToast(t('clients.addedMsg'))
    setShowForm(false)
    setForm({ nom: '', email: '', telephone: '', adresse: '' })
    load()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) { showToast('Erreur suppression : ' + error.message); return }
    setClients(c => c.filter(x => x.id !== id))
    showToast(t('clients.deletedMsg'))
    setDeleteId(null)
  }

  const filtered = clients.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.telephone ?? '').includes(search)
  )

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const newThisMonth = clients.filter(c => c.created_at >= startOfMonth).length

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="fixed top-4 right-4 z-50 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text)] shadow-2xl flex items-center gap-2"
          >
            <CheckCircle size={14} className="text-[#DC2626]" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">{t('clients.title')}</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {clients.length} {t('clients.subtitle')}
          </p>
        </div>
        <motion.button
          onClick={() => setShowForm(true)}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shrink-0"
          style={{ background: 'linear-gradient(135deg,#DC2626,#d4880a)', color: '#0F172A', boxShadow: '0 0 18px #DC262630' }}
        >
          <UserPlus size={15} /> {t('clients.newClient')}
        </motion.button>
      </motion.div>

      {/* KPI row */}
      <motion.div {...fadeUp(1)} className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label={t('clients.totalClients')} value={clients.length}   sub={t('clients.inBase')}         icon={Users}      color="#DC2626" />
        <KpiCard label={t('clients.newThisMonth')} value={newThisMonth}     sub={t('dash.ceMoisCi')}          icon={TrendingUp} color="#0F172A" />
        <KpiCard label={t('clients.withEmail')}    value={clients.filter(c => c.email).length} sub={t('clients.contactByEmail')} icon={Mail} color="#7C3AED" />
      </motion.div>

      {/* Search */}
      <motion.div {...fadeUp(2)} className="relative max-w-sm">
        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          className="w-full pl-9 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[#64748B] focus:outline-none focus:border-[#DC2626]/50 transition-colors"
          placeholder={t('clients.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </motion.div>

      {/* Empty state */}
      {clients.length === 0 ? (
        <motion.div {...fadeUp(3)} className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-alt)] flex items-center justify-center">
            <Users size={28} className="text-[var(--text-secondary)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">{t('clients.noClients')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('clients.addFirst')}</p>
          </div>
          <motion.button
            onClick={() => setShowForm(true)}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg,#DC2626,#d4880a)', color: '#0F172A' }}
          >
            <Plus size={14} /> {t('clients.addClient')}
          </motion.button>
        </motion.div>
      ) : filtered.length === 0 ? (
        <motion.div {...fadeUp(3)} className="text-center py-16 text-[var(--text-secondary)]">
          <Search size={28} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t('clients.noSearchResult')}</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c, i) => {
            const color = avatarColor(c.nom)
            return (
              <motion.div
                key={c.id}
                {...fadeUp(i % 12)}
                whileHover={{ y: -2 }}
                className="bg-[var(--card-bg)] border border-[var(--border)] hover:border-[var(--border)] rounded-2xl p-4 transition-colors group relative overflow-hidden"
              >
                {/* Subtle glow on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"
                  style={{ background: `radial-gradient(ellipse at 80% 20%, ${color}08 0%, transparent 70%)` }} />

                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                        style={{ background: `${color}20`, color }}
                      >
                        {initials(c.nom)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)] leading-tight">{c.nom}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{fmtDate(c.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 pl-0.5">
                    {c.email && (
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Mail size={11} style={{ color }} className="shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.telephone && (
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Phone size={11} style={{ color }} className="shrink-0" />
                        <span>{c.telephone}</span>
                      </div>
                    )}
                    {c.adresse && (
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <MapPin size={11} style={{ color }} className="shrink-0" />
                        <span className="truncate">{c.adresse}</span>
                      </div>
                    )}
                  </div>

                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all border opacity-0 group-hover:opacity-100"
                      style={{ borderColor: `${color}30`, color, background: `${color}0D` }}
                    >
                      <ArrowUpRight size={11} /> {t('clients.contact')}
                    </a>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── FORM MODAL ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl"
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#DC2626]/15 flex items-center justify-center">
                      <UserPlus size={15} className="text-[#DC2626]" />
                    </div>
                    <h2 className="text-base font-bold text-[var(--text)]">{t('clients.formTitle')}</h2>
                  </div>
                  <button onClick={() => setShowForm(false)} className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors p-1">
                    <X size={18} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <FormInput label={t('clients.fullName')} value={form.nom} onChange={v => setField('nom', v)} placeholder="Jean Dupont ou SARL ABC" />
                  <FormInput label={t('common.email')} type="email" value={form.email} onChange={v => setField('email', v)} placeholder="client@example.com" />
                  <FormInput label={t('common.phone')} value={form.telephone} onChange={v => setField('telephone', v)} placeholder="+242 06 000 0000" />
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1.5 font-medium">{t('clients.address')}</label>
                    <textarea
                      rows={2}
                      value={form.adresse}
                      onChange={e => setField('adresse', e.target.value)}
                      placeholder={t('clients.addressPlaceholder')}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] placeholder-[#64748B] focus:outline-none focus:border-[#DC2626]/60 transition-colors resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] text-sm font-medium transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !form.nom.trim()}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
                      style={{ background: 'linear-gradient(135deg,#DC2626,#d4880a)', color: '#0F172A' }}
                    >
                      {saving ? <Loader2 className="animate-spin" size={14} /> : <><Plus size={14} /> {t('clients.addBtn')}</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── DELETE CONFIRM ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteId && (
          <>
            <motion.div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteId(null)} />
            <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                className="w-full max-w-xs bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 text-center"
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={20} className="text-red-400" />
                </div>
                <p className="text-sm font-bold text-[var(--text)] mb-1">{t('clients.deleteConfirm')}</p>
                <p className="text-xs text-[var(--text-secondary)] mb-5">{t('clients.deleteWarning')}</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] text-sm font-medium transition-colors">
                    {t('common.cancel')}
                  </button>
                  <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-sm font-semibold transition-colors">
                    {t('common.delete')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
