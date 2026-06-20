'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import {
  Settings, BookOpen, Award, ToggleLeft, ToggleRight,
  Plus, Trash2, Save, RefreshCw, AlertTriangle, CheckCircle,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type SystemType = 'classique' | 'lmd' | 'hybride'

interface MentionRow {
  min: number
  label: string
  color: string
}

interface AcademicSettings {
  id?: string
  tenant_id?: string
  system_type: SystemType
  note_sur: 20 | 100
  moyenne_validation_ue: number
  moyenne_validation_semestre: number
  moyenne_validation_annee: number
  credits_par_semestre: number
  credits_par_annee: number
  compensation_matieres: boolean
  compensation_ue: boolean
  compensation_semestre: boolean
  compensation_annuelle: boolean
  seuil_note_compensable: number
  seuil_acces_rattrapage: number
  nb_max_matieres_rattrapage: number
  conservation_meilleure_note: boolean
  mentions: MentionRow[]
}

const DEFAULT: AcademicSettings = {
  system_type: 'classique',
  note_sur: 20,
  moyenne_validation_ue: 10,
  moyenne_validation_semestre: 10,
  moyenne_validation_annee: 10,
  credits_par_semestre: 30,
  credits_par_annee: 60,
  compensation_matieres: false,
  compensation_ue: false,
  compensation_semestre: false,
  compensation_annuelle: false,
  seuil_note_compensable: 7,
  seuil_acces_rattrapage: 8,
  nb_max_matieres_rattrapage: 3,
  conservation_meilleure_note: true,
  mentions: [
    { min: 16, label: 'Très Bien',  color: '#16A34A' },
    { min: 14, label: 'Bien',        color: '#DC2626' },
    { min: 12, label: 'Assez Bien', color: '#7C3AED' },
    { min: 10, label: 'Passable',   color: '#DC2626' },
    { min: 0,  label: 'Insuffisant',color: '#DC2626' },
  ],
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label, sub }: {
  value: boolean; onChange: (v: boolean) => void; label: string; sub?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-[var(--border)] transition-all"
    >
      <div className="text-left">
        <div className="text-sm text-[var(--text)]">{label}</div>
        {sub && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</div>}
      </div>
      {value
        ? <ToggleRight size={22} className="text-[#16A34A] shrink-0" />
        : <ToggleLeft  size={22} className="text-[var(--text-secondary)] shrink-0" />
      }
    </button>
  )
}

function NumInput({ label, value, onChange, min = 0, max, step = 0.5, sub }: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; sub?: string
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <input
        type="number" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#DC2626]/50"
      />
      {sub && <div className="text-[10px] text-[var(--text-secondary)] mt-1">{sub}</div>}
    </div>
  )
}

function SLabel({ text }: { text: string }) {
  return <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 mt-5 first:mt-0">{text}</h3>
}

// ── Tab: Général ──────────────────────────────────────────────────────────────

function TabGeneral({ s, setS, t }: {
  s: AcademicSettings
  setS: (fn: (prev: AcademicSettings) => AcademicSettings) => void
  t: (key: string) => string
}) {
  const SYSTEMS: { value: SystemType; labelKey: string; descKey: string }[] = [
    { value: 'classique', labelKey: 'acad.sysClassique', descKey: 'acad.sysClassiqueDesc' },
    { value: 'lmd',       labelKey: 'acad.sysLMD',       descKey: 'acad.sysLMDDesc' },
    { value: 'hybride',   labelKey: 'acad.sysHybride',   descKey: 'acad.sysHybrideDesc' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <SLabel text={t('acad.sysLabel')} />
        <div className="space-y-2">
          {SYSTEMS.map(sys => (
            <button
              key={sys.value}
              type="button"
              onClick={() => setS(p => ({ ...p, system_type: sys.value }))}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                s.system_type === sys.value
                  ? 'border-[#DC2626]/60 bg-[#DC2626]/8'
                  : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border)]'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                s.system_type === sys.value ? 'border-[#DC2626]' : 'border-[#64748B]'
              }`}>
                {s.system_type === sys.value && <div className="w-2 h-2 rounded-full bg-[#DC2626]" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">{t(sys.labelKey)}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">{t(sys.descKey)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SLabel text={t('acad.bareme')} />
        <div className="flex gap-3">
          {([20, 100] as const).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setS(p => ({ ...p, note_sur: n }))}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                s.note_sur === n
                  ? 'border-[#DC2626]/60 bg-[#DC2626]/10 text-[#DC2626]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border)]'
              }`}
            >
              {t('acad.sur')} {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-2">
          {s.note_sur === 100
            ? t('acad.baremeDesc100')
            : t('acad.baremeDesc20')}
        </p>
      </div>
    </div>
  )
}

// ── Tab: Mentions ─────────────────────────────────────────────────────────────

function TabMentions({ s, setS, t }: {
  s: AcademicSettings
  setS: (fn: (prev: AcademicSettings) => AcademicSettings) => void
  t: (key: string) => string
}) {
  function addMention() {
    setS(p => ({
      ...p,
      mentions: [...p.mentions, { min: 0, label: t('acad.newMention'), color: '#64748B' }],
    }))
  }

  function updateMention(i: number, field: keyof MentionRow, val: string | number) {
    setS(p => {
      const mentions = [...p.mentions]
      mentions[i] = { ...mentions[i], [field]: val }
      return { ...p, mentions }
    })
  }

  function removeMention(i: number) {
    setS(p => ({ ...p, mentions: p.mentions.filter((_, idx) => idx !== i) }))
  }

  const sorted = [...s.mentions].sort((a, b) => b.min - a.min)

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-secondary)]">
        {t('acad.mentionsDesc')}
      </p>

      <div className="space-y-2">
        {s.mentions.map((m, i) => (
          <div key={i} className="flex items-center gap-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
            {/* Color swatch */}
            <div className="relative shrink-0">
              <div
                className="w-8 h-8 rounded-lg border border-[var(--border)] cursor-pointer"
                style={{ background: m.color }}
                title={t('acad.colorChange')}
              />
              <input
                type="color"
                value={m.color}
                onChange={e => updateMention(i, 'color', e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </div>

            {/* Label */}
            <input
              type="text"
              value={m.label}
              onChange={e => updateMention(i, 'label', e.target.value)}
              placeholder="Label"
              className="flex-1 bg-transparent border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[#DC2626]/50"
            />

            {/* Seuil min */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-[var(--text-secondary)]">≥</span>
              <input
                type="number"
                value={m.min}
                min={0}
                max={s.note_sur}
                onChange={e => updateMention(i, 'min', parseFloat(e.target.value) || 0)}
                className="w-16 bg-transparent border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-[var(--text)] text-center focus:outline-none focus:border-[#DC2626]/50"
              />
            </div>

            {/* Preview */}
            <div
              className="hidden sm:flex items-center px-2 py-1 rounded-full text-[10px] font-bold shrink-0"
              style={{ color: m.color, background: `${m.color}18` }}
            >
              {m.label}
            </div>

            <button
              type="button"
              onClick={() => removeMention(i)}
              className="shrink-0 p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#DC2626] hover:bg-[#DC2626]/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addMention}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[var(--border)] text-[var(--text-secondary)] text-sm hover:border-[#DC2626]/40 hover:text-[#DC2626] transition-colors"
      >
        <Plus size={14} />
        {t('acad.addMention')}
      </button>

      {/* Aperçu trié */}
      <div className="mt-4 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
        <div className="text-xs text-[var(--text-secondary)] mb-2 font-semibold uppercase tracking-wider">{t('acad.apercu')}</div>
        <div className="flex flex-wrap gap-2">
          {sorted.map((m, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ color: m.color, background: `${m.color}18` }}
            >
              <span>{m.label}</span>
              <span className="opacity-60">≥ {m.min}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab: LMD ──────────────────────────────────────────────────────────────────

function TabLMD({ s, setS, t }: {
  s: AcademicSettings
  setS: (fn: (prev: AcademicSettings) => AcademicSettings) => void
  t: (key: string) => string
}) {
  const isLMD = s.system_type === 'lmd' || s.system_type === 'hybride'

  return (
    <div className="space-y-5">
      {!isLMD && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#DC2626]/8 border border-[#DC2626]/20 text-[#DC2626] text-xs">
          <AlertTriangle size={13} />
          {t('acad.lmdWarning')}
        </div>
      )}

      <div>
        <SLabel text={t('acad.validationAvg')} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumInput
            label={t('acad.validUE')}
            value={s.moyenne_validation_ue}
            onChange={v => setS(p => ({ ...p, moyenne_validation_ue: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub={t('acad.validUESub')}
          />
          <NumInput
            label={t('acad.validSemestre')}
            value={s.moyenne_validation_semestre}
            onChange={v => setS(p => ({ ...p, moyenne_validation_semestre: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub={t('acad.validSemestreSub')}
          />
          <NumInput
            label={t('acad.validAnnee')}
            value={s.moyenne_validation_annee}
            onChange={v => setS(p => ({ ...p, moyenne_validation_annee: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub={t('acad.validAnneeSub')}
          />
        </div>
      </div>

      <div>
        <SLabel text={t('acad.creditsECTS')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumInput
            label={t('acad.creditsSemestre')}
            value={s.credits_par_semestre}
            onChange={v => setS(p => ({ ...p, credits_par_semestre: Math.round(v) }))}
            min={1} max={60} step={1}
            sub={t('acad.creditsSemestreSub')}
          />
          <NumInput
            label={t('acad.creditsAnnee')}
            value={s.credits_par_annee}
            onChange={v => setS(p => ({ ...p, credits_par_annee: Math.round(v) }))}
            min={1} max={120} step={1}
            sub={t('acad.creditsAnneeSub')}
          />
        </div>
      </div>
    </div>
  )
}

// ── Tab: Compensation & Rattrapage ────────────────────────────────────────────

function TabCompensation({ s, setS, t }: {
  s: AcademicSettings
  setS: (fn: (prev: AcademicSettings) => AcademicSettings) => void
  t: (key: string) => string
}) {
  const anyComp = s.compensation_matieres || s.compensation_ue || s.compensation_semestre || s.compensation_annuelle

  return (
    <div className="space-y-5">
      <div>
        <SLabel text={t('acad.compensation')} />
        <div className="space-y-2">
          <Toggle
            value={s.compensation_matieres}
            onChange={v => setS(p => ({ ...p, compensation_matieres: v }))}
            label={t('acad.compMatieres')}
            sub={t('acad.compMatieresSub')}
          />
          <Toggle
            value={s.compensation_ue}
            onChange={v => setS(p => ({ ...p, compensation_ue: v }))}
            label={t('acad.compUE')}
            sub={t('acad.compUESub')}
          />
          <Toggle
            value={s.compensation_semestre}
            onChange={v => setS(p => ({ ...p, compensation_semestre: v }))}
            label={t('acad.compSemestre')}
            sub={t('acad.compSemestreSub')}
          />
          <Toggle
            value={s.compensation_annuelle}
            onChange={v => setS(p => ({ ...p, compensation_annuelle: v }))}
            label={t('acad.compAnnuelle')}
            sub={t('acad.compAnnuelleSub')}
          />
        </div>
      </div>

      {anyComp && (
        <div>
          <SLabel text={t('acad.seuilComp')} />
          <NumInput
            label={`${t('acad.noteMinComp')} (${t('acad.sur')} ${s.note_sur})`}
            value={s.seuil_note_compensable}
            onChange={v => setS(p => ({ ...p, seuil_note_compensable: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub={t('acad.noteMinCompSub')}
          />
        </div>
      )}

      <div>
        <SLabel text={t('acad.rattrapage')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumInput
            label={`${t('acad.seuilRattrapage')} (${t('acad.sur')} ${s.note_sur})`}
            value={s.seuil_acces_rattrapage}
            onChange={v => setS(p => ({ ...p, seuil_acces_rattrapage: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub={t('acad.seuilRattrapageSub')}
          />
          <NumInput
            label={t('acad.maxMatieres')}
            value={s.nb_max_matieres_rattrapage}
            onChange={v => setS(p => ({ ...p, nb_max_matieres_rattrapage: Math.round(v) }))}
            min={1} max={20} step={1}
            sub={t('acad.maxMatieresSub')}
          />
        </div>

        <div className="mt-3">
          <Toggle
            value={s.conservation_meilleure_note}
            onChange={v => setS(p => ({ ...p, conservation_meilleure_note: v }))}
            label={t('acad.conserverNote')}
            sub={t('acad.conserverNoteSub')}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ParametresAcademiquesPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()

  const TABS = [
    { id: 'general',      label: t('acad.tabGeneral'),      icon: Settings  },
    { id: 'mentions',     label: t('acad.tabMentions'),     icon: Award     },
    { id: 'lmd',          label: t('acad.tabLMD'),          icon: BookOpen  },
    { id: 'compensation', label: t('acad.tabCompensation'), icon: ToggleLeft },
  ] as const
  type Tab = typeof TABS[number]['id']

  const [tab, setTab]           = useState<Tab>('general')
  const [settings, setSettings] = useState<AcademicSettings>(DEFAULT)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState<{ ok: boolean; msg: string } | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('academic_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (data) {
      setSettings({
        ...DEFAULT,
        ...data,
        mentions: Array.isArray(data.mentions) ? data.mentions : DEFAULT.mentions,
      })
    }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!tenantId) return
    setSaving(true)
    const payload = { ...settings, tenant_id: tenantId }
    const { error } = await supabase
      .from('academic_settings')
      .upsert(payload, { onConflict: 'tenant_id' })
    setSaving(false)
    if (error) {
      setToast({ ok: false, msg: t('acad.saveError') })
    } else {
      setToast({ ok: true, msg: t('acad.saved') })
    }
    setTimeout(() => setToast(null), 3500)
  }

  const tabContent: Record<Tab, React.ReactNode> = {
    general:      <TabGeneral      s={settings} setS={setSettings} t={t} />,
    mentions:     <TabMentions     s={settings} setS={setSettings} t={t} />,
    lmd:          <TabLMD          s={settings} setS={setSettings} t={t} />,
    compensation: <TabCompensation s={settings} setS={setSettings} t={t} />,
  }

  return (
    <div className="space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">{t('acad.title')}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {t('acad.subtitle')}
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00b9a7] text-white text-sm font-semibold hover:bg-[#DC2626]/90 disabled:opacity-50 transition-all"
          >
            {saving
              ? <RefreshCw size={14} className="animate-spin" />
              : <Save size={14} />
            }
            {t('acad.save')}
          </button>
        </motion.div>

        {/* Toast */}
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
              toast.ok
                ? 'bg-[#16A34A]/10 border-[#16A34A]/25 text-[#16A34A]'
                : 'bg-[#DC2626]/10 border-[#DC2626]/25 text-[#DC2626]'
            }`}
          >
            {toast.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            {toast.msg}
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-x-auto">
          {TABS.map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center ${
                tab === tabItem.id
                  ? 'bg-[#00b9a7] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              <tabItem.icon size={13} />
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-5 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl"
          >
            {tabContent[tab]}
          </motion.div>
        )}

        {/* Save button (bottom, for convenience on mobile) */}
        <div className="flex justify-end pb-6">
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00b9a7] text-white text-sm font-semibold hover:bg-[#DC2626]/90 disabled:opacity-50 transition-all"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {t('acad.saveParams')}
          </button>
        </div>
    </div>
  )
}
