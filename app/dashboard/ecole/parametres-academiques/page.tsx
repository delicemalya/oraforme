'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
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
    { min: 16, label: 'Très Bien',  color: '#2EA043' },
    { min: 14, label: 'Bien',        color: '#F51E33' },
    { min: 12, label: 'Assez Bien', color: '#8B0070' },
    { min: 10, label: 'Passable',   color: '#F51E33' },
    { min: 0,  label: 'Insuffisant',color: '#F51E33' },
  ],
}

const TABS = [
  { id: 'general',      label: 'Général',              icon: Settings  },
  { id: 'mentions',     label: 'Mentions',             icon: Award     },
  { id: 'lmd',          label: 'Règles LMD',           icon: BookOpen  },
  { id: 'compensation', label: 'Compensation & Rattr.', icon: ToggleLeft },
] as const
type Tab = typeof TABS[number]['id']

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label, sub }: {
  value: boolean; onChange: (v: boolean) => void; label: string; sub?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full p-3 bg-[#142850] border border-[var(--border)] rounded-lg hover:border-[var(--border)] transition-all"
    >
      <div className="text-left">
        <div className="text-sm text-[#FFFFFF]">{label}</div>
        {sub && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</div>}
      </div>
      {value
        ? <ToggleRight size={22} className="text-[#2EA043] shrink-0" />
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
        className="w-full bg-[#142850] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#F51E33]/50"
      />
      {sub && <div className="text-[10px] text-[var(--text-secondary)] mt-1">{sub}</div>}
    </div>
  )
}

function SLabel({ text }: { text: string }) {
  return <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 mt-5 first:mt-0">{text}</h3>
}

// ── Tab: Général ──────────────────────────────────────────────────────────────

function TabGeneral({ s, setS }: { s: AcademicSettings; setS: (fn: (prev: AcademicSettings) => AcademicSettings) => void }) {
  const SYSTEMS: { value: SystemType; label: string; desc: string }[] = [
    { value: 'classique', label: 'Classique',  desc: 'Notes sur 20, trimestres ou semestres, sans crédits ECTS' },
    { value: 'lmd',       label: 'LMD',        desc: 'Licence–Master–Doctorat avec crédits ECTS et UE' },
    { value: 'hybride',   label: 'Hybride',    desc: 'Mélange classique + LMD selon le niveau des étudiants' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <SLabel text="Système pédagogique" />
        <div className="space-y-2">
          {SYSTEMS.map(sys => (
            <button
              key={sys.value}
              type="button"
              onClick={() => setS(p => ({ ...p, system_type: sys.value }))}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                s.system_type === sys.value
                  ? 'border-[#F51E33]/60 bg-[#F51E33]/8'
                  : 'border-[var(--border)] bg-[#142850] hover:border-[var(--border)]'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                s.system_type === sys.value ? 'border-[#F51E33]' : 'border-[#484F58]'
              }`}>
                {s.system_type === sys.value && <div className="w-2 h-2 rounded-full bg-[#F51E33]" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#FFFFFF]">{sys.label}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">{sys.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SLabel text="Barème de notation" />
        <div className="flex gap-3">
          {([20, 100] as const).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setS(p => ({ ...p, note_sur: n }))}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                s.note_sur === n
                  ? 'border-[#F51E33]/60 bg-[#F51E33]/10 text-[#F51E33]'
                  : 'border-[var(--border)] bg-[#142850] text-[var(--text-secondary)] hover:border-[var(--border)]'
              }`}
            >
              Sur {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-2">
          {s.note_sur === 100
            ? 'Les notes sont saisies sur 100. Les moyennes sont converties sur 20 pour les rapports.'
            : 'Notation standard sur 20 points.'}
        </p>
      </div>
    </div>
  )
}

// ── Tab: Mentions ─────────────────────────────────────────────────────────────

function TabMentions({ s, setS }: { s: AcademicSettings; setS: (fn: (prev: AcademicSettings) => AcademicSettings) => void }) {
  function addMention() {
    setS(p => ({
      ...p,
      mentions: [...p.mentions, { min: 0, label: 'Nouvelle mention', color: '#8B949E' }],
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
        Les mentions s&apos;appliquent automatiquement selon la moyenne générale. Elles sont triées du seuil le plus haut au plus bas.
      </p>

      <div className="space-y-2">
        {s.mentions.map((m, i) => (
          <div key={i} className="flex items-center gap-2 p-3 bg-[#142850] border border-[var(--border)] rounded-xl">
            {/* Color swatch */}
            <div className="relative shrink-0">
              <div
                className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer"
                style={{ background: m.color }}
                title="Changer la couleur"
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
              className="flex-1 bg-transparent border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#F51E33]/50"
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
                className="w-16 bg-transparent border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-[#FFFFFF] text-center focus:outline-none focus:border-[#F51E33]/50"
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
              className="shrink-0 p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#F51E33] hover:bg-[#F51E33]/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addMention}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[var(--border)] text-[var(--text-secondary)] text-sm hover:border-[#F51E33]/40 hover:text-[#F51E33] transition-colors"
      >
        <Plus size={14} />
        Ajouter une mention
      </button>

      {/* Aperçu trié */}
      <div className="mt-4 p-3 bg-[#142850] border border-[var(--border)] rounded-xl">
        <div className="text-xs text-[var(--text-secondary)] mb-2 font-semibold uppercase tracking-wider">Aperçu (ordre appliqué)</div>
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

function TabLMD({ s, setS }: { s: AcademicSettings; setS: (fn: (prev: AcademicSettings) => AcademicSettings) => void }) {
  const isLMD = s.system_type === 'lmd' || s.system_type === 'hybride'

  return (
    <div className="space-y-5">
      {!isLMD && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F51E33]/8 border border-[#F51E33]/20 text-[#F51E33] text-xs">
          <AlertTriangle size={13} />
          Ces règles s&apos;appliquent uniquement en mode LMD ou Hybride. Changez le système dans l&apos;onglet Général.
        </div>
      )}

      <div>
        <SLabel text="Moyennes de validation" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumInput
            label="Validation UE"
            value={s.moyenne_validation_ue}
            onChange={v => setS(p => ({ ...p, moyenne_validation_ue: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub="Moyenne minimale pour valider une unité d'enseignement"
          />
          <NumInput
            label="Validation semestre"
            value={s.moyenne_validation_semestre}
            onChange={v => setS(p => ({ ...p, moyenne_validation_semestre: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub="Moyenne minimale pour valider le semestre"
          />
          <NumInput
            label="Validation année"
            value={s.moyenne_validation_annee}
            onChange={v => setS(p => ({ ...p, moyenne_validation_annee: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub="Moyenne annuelle requise pour passer en année supérieure"
          />
        </div>
      </div>

      <div>
        <SLabel text="Crédits ECTS" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumInput
            label="Crédits par semestre"
            value={s.credits_par_semestre}
            onChange={v => setS(p => ({ ...p, credits_par_semestre: Math.round(v) }))}
            min={1} max={60} step={1}
            sub="Standard LMD : 30 crédits par semestre"
          />
          <NumInput
            label="Crédits par année"
            value={s.credits_par_annee}
            onChange={v => setS(p => ({ ...p, credits_par_annee: Math.round(v) }))}
            min={1} max={120} step={1}
            sub="Standard LMD : 60 crédits par année"
          />
        </div>
      </div>
    </div>
  )
}

// ── Tab: Compensation & Rattrapage ────────────────────────────────────────────

function TabCompensation({ s, setS }: { s: AcademicSettings; setS: (fn: (prev: AcademicSettings) => AcademicSettings) => void }) {
  const anyComp = s.compensation_matieres || s.compensation_ue || s.compensation_semestre || s.compensation_annuelle

  return (
    <div className="space-y-5">
      <div>
        <SLabel text="Compensation" />
        <div className="space-y-2">
          <Toggle
            value={s.compensation_matieres}
            onChange={v => setS(p => ({ ...p, compensation_matieres: v }))}
            label="Compensation entre matières"
            sub="Une bonne note dans une matière peut compenser une note insuffisante dans une autre"
          />
          <Toggle
            value={s.compensation_ue}
            onChange={v => setS(p => ({ ...p, compensation_ue: v }))}
            label="Compensation entre UE"
            sub="Compensation entre les unités d'enseignement d'un même semestre (LMD)"
          />
          <Toggle
            value={s.compensation_semestre}
            onChange={v => setS(p => ({ ...p, compensation_semestre: v }))}
            label="Compensation entre semestres"
            sub="Le S2 peut compenser un S1 insuffisant si la moyenne globale est atteinte"
          />
          <Toggle
            value={s.compensation_annuelle}
            onChange={v => setS(p => ({ ...p, compensation_annuelle: v }))}
            label="Compensation annuelle"
            sub="Compensation sur l'ensemble de l'année académique"
          />
        </div>
      </div>

      {anyComp && (
        <div>
          <SLabel text="Seuil de compensation" />
          <NumInput
            label={`Note minimale compensable (sur ${s.note_sur})`}
            value={s.seuil_note_compensable}
            onChange={v => setS(p => ({ ...p, seuil_note_compensable: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub="Une note inférieure à ce seuil ne peut pas être compensée, même avec de bonnes notes ailleurs"
          />
        </div>
      )}

      <div>
        <SLabel text="Session de rattrapage" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumInput
            label={`Seuil d'accès au rattrapage (sur ${s.note_sur})`}
            value={s.seuil_acces_rattrapage}
            onChange={v => setS(p => ({ ...p, seuil_acces_rattrapage: v }))}
            min={0} max={s.note_sur} step={0.5}
            sub="Moyenne minimale pour être admis à une session de rattrapage"
          />
          <NumInput
            label="Nb max matières en rattrapage"
            value={s.nb_max_matieres_rattrapage}
            onChange={v => setS(p => ({ ...p, nb_max_matieres_rattrapage: Math.round(v) }))}
            min={1} max={20} step={1}
            sub="Nombre maximum de matières qu'un étudiant peut repasser"
          />
        </div>

        <div className="mt-3">
          <Toggle
            value={s.conservation_meilleure_note}
            onChange={v => setS(p => ({ ...p, conservation_meilleure_note: v }))}
            label="Conserver la meilleure note"
            sub="En cas de rattrapage, on retient la meilleure des deux notes (session normale vs rattrapage)"
          />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ParametresAcademiquesPage() {
  const { tenantId } = useTenant()

  const [tab, setTab]       = useState<Tab>('general')
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
  }, [supabase, tenantId])

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
      setToast({ ok: false, msg: 'Erreur lors de l\'enregistrement' })
    } else {
      setToast({ ok: true, msg: 'Paramètres académiques sauvegardés' })
    }
    setTimeout(() => setToast(null), 3500)
  }

  const tabContent: Record<Tab, React.ReactNode> = {
    general:      <TabGeneral      s={settings} setS={setSettings} />,
    mentions:     <TabMentions     s={settings} setS={setSettings} />,
    lmd:          <TabLMD          s={settings} setS={setSettings} />,
    compensation: <TabCompensation s={settings} setS={setSettings} />,
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
            <h1 className="text-xl font-bold text-[#FFFFFF]">Paramètres académiques</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Règles LMD, mentions, compensation & rattrapage
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F51E33] text-black text-sm font-semibold hover:bg-[#F51E33]/90 disabled:opacity-50 transition-all"
          >
            {saving
              ? <RefreshCw size={14} className="animate-spin" />
              : <Save size={14} />
            }
            Enregistrer
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
                ? 'bg-[#2EA043]/10 border-[#2EA043]/25 text-[#2EA043]'
                : 'bg-[#F51E33]/10 border-[#F51E33]/25 text-[#F51E33]'
            }`}
          >
            {toast.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            {toast.msg}
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center ${
                tab === t.id
                  ? 'bg-[#F51E33] text-black'
                  : 'text-[var(--text-secondary)] hover:text-[#FFFFFF]'
              }`}
            >
              <t.icon size={13} />
              {t.label}
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F51E33] text-black text-sm font-semibold hover:bg-[#F51E33]/90 disabled:opacity-50 transition-all"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer les paramètres
          </button>
        </div>
    </div>
  )
}
