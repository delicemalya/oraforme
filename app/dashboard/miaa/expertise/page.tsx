'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search, ChevronLeft, Download, Printer, Loader2,
  RefreshCw, Clock, ChevronRight, X, Copy, Check,
  Sparkles, FileText,
} from 'lucide-react'
import Link from 'next/link'
import { useTenant } from '@/lib/hooks/useTenant'
import { usePlanFeature } from '@/lib/hooks/usePlanFeature'
import PlanFeatureGate from '@/components/PlanFeatureGate'
import {
  EXPERTISE_CATEGORIES,
  EXPERTISE_DOCS,
  COMPLEXITY_LABEL,
  getDocsByCategorie,
  type ExpertiseCat,
  type ExpertiseDoc,
} from '@/lib/miaa/expertise-catalog'
import { PAYS_LIST } from '@/lib/miaa/pays-localization'

// ── Types locaux ───────────────────────────────────────────────────────────────

interface HistoriqueDoc {
  id:          string
  categorie:   string
  type_doc:    string
  titre:       string
  pays:        string
  tokens_used: number
  created_at:  string
}

interface GeneratedDoc {
  id:          string
  titre:       string
  contenu:     string
  tokens_used: number
  model:       string
  created_at:  string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const COMPLEXITY_COLOR: Record<string, string> = {
  rapide:   '#16A34A',
  standard: '#2563EB',
  complet:  '#9333EA',
}

function downloadTxt(titre: string, contenu: string) {
  const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `${titre.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 80)}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}

function printDoc(titre: string, contenu: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${titre}</title>
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 2cm; color: #000; }
      pre { font-family: inherit; white-space: pre-wrap; word-wrap: break-word; }
      @media print { body { margin: 1.5cm; } }
    </style>
  </head><body><pre>${contenu.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 500)
}

// ── Composant : Carte catégorie ────────────────────────────────────────────────

function CategoryCard({ cat, onClick, active }: { cat: ExpertiseCat; onClick: () => void; active: boolean }) {
  const count = getDocsByCategorie(cat.id).length
  return (
    <button onClick={onClick}
      className="rounded-2xl border p-4 text-left transition-all hover:shadow-md active:scale-[0.98] w-full"
      style={{
        borderColor: active ? cat.color : cat.border,
        background:  active ? cat.bgColor : 'var(--surface)',
        boxShadow:   active ? `0 0 0 2px ${cat.color}30` : undefined,
      }}>
      <div className="text-2xl mb-2">{cat.icon}</div>
      <p className="text-sm font-bold text-[var(--text)] leading-tight">{cat.label}</p>
      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">{cat.description}</p>
      <div className="mt-2 flex items-center gap-1">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: cat.bgColor, color: cat.color, border: `1px solid ${cat.border}` }}>
          {count === 0 ? 'Historique' : `${count} modèles`}
        </span>
      </div>
    </button>
  )
}

// ── Composant : Carte document ─────────────────────────────────────────────────

function DocCard({ doc, onSelect, selected }: { doc: ExpertiseDoc; onSelect: () => void; selected: boolean }) {
  const cat = EXPERTISE_CATEGORIES.find(c => c.id === doc.categorie)
  return (
    <button onClick={onSelect}
      className="rounded-2xl border p-4 text-left transition-all hover:shadow-md active:scale-[0.98] w-full"
      style={{
        borderColor: selected ? (cat?.color ?? '#F59E0B') : 'var(--border)',
        background:  selected ? (cat?.bgColor ?? '#FFFBEB') : 'var(--surface)',
        boxShadow:   selected ? `0 0 0 2px ${cat?.color ?? '#F59E0B'}30` : undefined,
      }}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{doc.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text)] leading-tight">{doc.label}</p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug line-clamp-2">{doc.description}</p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
              style={{ color: COMPLEXITY_COLOR[doc.complexity], borderColor: COMPLEXITY_COLOR[doc.complexity] + '40', background: COMPLEXITY_COLOR[doc.complexity] + '10' }}>
              {COMPLEXITY_LABEL[doc.complexity]}
            </span>
          </div>
        </div>
        <ChevronRight size={14} className="text-[var(--text-secondary)] shrink-0 mt-1" />
      </div>
    </button>
  )
}

// ── Composant : Formulaire de génération ──────────────────────────────────────

function GenerationForm({
  doc,
  pays,
  onPaysChange,
  onGenerate,
  generating,
  result,
  onClose,
}: {
  doc:           ExpertiseDoc
  pays:          string
  onPaysChange:  (p: string) => void
  onGenerate:    (inputs: Record<string, string>) => void
  generating:    boolean
  result:        GeneratedDoc | null
  onClose:       () => void
}) {
  const [inputs,  setInputs]  = useState<Record<string, string>>({})
  const [copied,  setCopied]  = useState(false)
  const cat = EXPERTISE_CATEGORIES.find(c => c.id === doc.categorie)

  function handleGenerate() {
    onGenerate(inputs)
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(result.contenu)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]"
        style={{ background: cat?.bgColor }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{doc.icon}</span>
          <div>
            <p className="text-sm font-bold text-[var(--text)]">{doc.label}</p>
            <p className="text-[11px]" style={{ color: cat?.color }}>{COMPLEXITY_LABEL[doc.complexity]}</p>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-black/10 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Inputs */}
      {!result && (
        <div className="p-4 space-y-3">
          {/* Pays — toujours présent */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text)] mb-1">Pays / Juridiction</label>
            <select
              value={pays}
              onChange={e => onPaysChange(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#F59E0B]">
              {PAYS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Champs spécifiques au document */}
          {doc.inputs.map(field => (
            <div key={field.id}>
              <label className="block text-xs font-semibold text-[var(--text)] mb-1">
                {field.label}
                {field.required && <span className="text-[#DC2626] ml-0.5">*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={inputs[field.id] ?? field.defaultValue ?? ''}
                  onChange={e => setInputs(p => ({ ...p, [field.id]: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#F59E0B]">
                  {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={inputs[field.id] ?? ''}
                  onChange={e => setInputs(p => ({ ...p, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#F59E0B] resize-none" />
              ) : (
                <input
                  type={field.type}
                  value={inputs[field.id] ?? ''}
                  onChange={e => setInputs(p => ({ ...p, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#F59E0B]" />
              )}
            </div>
          ))}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: cat?.color ?? '#F59E0B' }}>
            {generating
              ? <><Loader2 size={15} className="animate-spin" /> Génération en cours…</>
              : <><Sparkles size={15} /> Générer avec MIAA+</>}
          </button>
        </div>
      )}

      {/* Résultat */}
      {result && (
        <div className="p-4 space-y-3">
          {/* Actions */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-semibold text-[var(--text)]">{result.titre}</p>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:border-[#F59E0B] transition-colors">
                {copied ? <Check size={11} style={{ color: '#16A34A' }} /> : <Copy size={11} />}
                {copied ? 'Copié !' : 'Copier'}
              </button>
              <button onClick={() => downloadTxt(result.titre, result.contenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:border-[#F59E0B] transition-colors">
                <Download size={11} style={{ color: '#F59E0B' }} /> .txt
              </button>
              <button onClick={() => printDoc(result.titre, result.contenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:border-[#2563EB] transition-colors">
                <Printer size={11} style={{ color: '#2563EB' }} /> PDF
              </button>
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]">
            {result.tokens_used} tokens · {result.model} · {new Date(result.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {/* Document */}
          <div className="rounded-xl border border-[var(--border)] bg-white/60 p-4 max-h-[480px] overflow-y-auto">
            <pre className="text-[11px] text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed">
              {result.contenu}
            </pre>
          </div>
          {/* Régénérer */}
          <button onClick={() => onClose()}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] underline transition-colors">
            ← Modifier les paramètres
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MIAAExpertisePage() {
  const { allowed: canMiaaExpert } = usePlanFeature('miaa-expert')
  const { tenantId } = useTenant()

  const [search,         setSearch]         = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedDoc,    setSelectedDoc]    = useState<ExpertiseDoc | null>(null)
  const [pays,           setPays]           = useState('Congo')
  const [generating,     setGenerating]     = useState(false)
  const [result,         setResult]         = useState<GeneratedDoc | null>(null)
  const [historique,     setHistorique]     = useState<HistoriqueDoc[]>([])
  const [loadingHisto,   setLoadingHisto]   = useState(false)

  // Filtrage des documents selon search + catégorie
  const visibleDocs = useMemo(() => {
    let docs = activeCategory === 'bibliotheque' ? []
      : activeCategory ? getDocsByCategorie(activeCategory)
      : EXPERTISE_DOCS

    if (search.trim()) {
      const q = search.toLowerCase()
      docs = docs.filter(d =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.categorie.toLowerCase().includes(q)
      )
    }
    return docs
  }, [activeCategory, search])

  // Charger l'historique quand bibliothèque est sélectionné ou au montage
  const loadHistorique = useCallback(async (cat?: string) => {
    if (!tenantId) return
    setLoadingHisto(true)
    try {
      const params = new URLSearchParams({ tenant_id: tenantId, limit: '30' })
      if (cat && cat !== 'bibliotheque') params.set('categorie', cat)
      const res  = await fetch(`/api/miaa/expertise?${params}`)
      const data = await res.json() as { documents: HistoriqueDoc[] }
      setHistorique(data.documents ?? [])
    } catch {}
    setLoadingHisto(false)
  }, [tenantId])

  useEffect(() => {
    loadHistorique()
  }, [loadHistorique])

  function handleSelectCategory(catId: string) {
    setActiveCategory(prev => prev === catId ? null : catId)
    setSelectedDoc(null)
    setResult(null)
    if (catId === 'bibliotheque') loadHistorique()
  }

  function handleSelectDoc(doc: ExpertiseDoc) {
    setSelectedDoc(prev => prev?.id === doc.id ? null : doc)
    setResult(null)
  }

  async function handleGenerate(inputs: Record<string, string>) {
    if (!tenantId || !selectedDoc) return
    setGenerating(true)
    try {
      const res  = await fetch('/api/miaa/expertise', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tenant_id: tenantId,
          type_doc:  selectedDoc.id,
          pays,
          inputs,
        }),
      })
      const data = await res.json() as GeneratedDoc & { error?: string }
      if (data.error) throw new Error(data.error)
      setResult(data)
      loadHistorique()
    } catch (err) {
      console.error(err)
    }
    setGenerating(false)
  }

  const activeCount = activeCategory
    ? getDocsByCategorie(activeCategory).length
    : EXPERTISE_DOCS.length

  if (!canMiaaExpert) return <PlanFeatureGate feature="miaa-expert" />

  return (
    <div className="w-full space-y-5 pb-10">

      {/* Retour */}
      <Link href="/dashboard/miaa"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> MIAA+
      </Link>

      {/* Hero */}
      <div className="rounded-2xl p-6 relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #F59E0B 0%, transparent 55%)' }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} style={{ color: '#F59E0B' }} />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/60">MIAA+ Marketplace</span>
            </div>
            <h1 className="text-xl font-bold">Expertise Professionnelle</h1>
            <p className="text-sm text-white/60 mt-0.5 max-w-lg">
              {EXPERTISE_DOCS.length} modèles · 10 catégories · 15 pays · Documents prêts à l'usage
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: '#F59E0B20', color: '#F59E0B', border: '1px solid #F59E0B40' }}>
              🌍 OHADA + Europe
            </div>
            <div className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: '#6366F120', color: '#A5B4FC', border: '1px solid #6366F140' }}>
              ⚖️ Conforme droit local
            </div>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="relative mt-5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un document… (ex: bilan, contrat CDD, audit, business plan)"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }} />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Grille catégories */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[var(--text)]">Catégories</h2>
          {activeCategory && (
            <button onClick={() => { setActiveCategory(null); setSelectedDoc(null); setResult(null) }}
              className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[#F59E0B] transition-colors">
              <X size={12} /> Tout afficher
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {EXPERTISE_CATEGORIES.map(cat => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              onClick={() => handleSelectCategory(cat.id)}
              active={activeCategory === cat.id}
            />
          ))}
        </div>
      </div>

      {/* Bibliothèque */}
      {activeCategory === 'bibliotheque' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text)]">
              Bibliothèque documentaire
              {historique.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ background: '#374151' }}>{historique.length}</span>
              )}
            </h2>
            <button onClick={() => loadHistorique()}
              className="p-1.5 rounded-xl border border-[var(--border)] hover:border-[#F59E0B] transition-colors">
              <RefreshCw size={13} className={loadingHisto ? 'animate-spin' : ''} style={{ color: '#F59E0B' }} />
            </button>
          </div>

          {loadingHisto ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: '#F59E0B' }} />
            </div>
          ) : historique.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
              <FileText size={32} className="mx-auto mb-3 text-[var(--text-secondary)]" />
              <p className="text-sm font-medium text-[var(--text)]">Bibliothèque vide</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Vos documents générés apparaîtront ici.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {historique.map(doc => {
                const cat = EXPERTISE_CATEGORIES.find(c => c.id === doc.categorie)
                return (
                  <div key={doc.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{cat?.icon ?? '📄'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)] line-clamp-1">{doc.titre}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: cat?.bgColor, color: cat?.color, border: `1px solid ${cat?.border}` }}>
                            {cat?.label}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">{doc.pays}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-secondary)]">
                          <Clock size={10} />
                          {new Date(doc.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                          {doc.tokens_used > 0 && <span> · {doc.tokens_used} tokens</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Documents de la catégorie + formulaire */}
      {activeCategory !== 'bibliotheque' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Colonne documents */}
          <div className="lg:col-span-3 space-y-3">
            {search.trim() === '' && (
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[var(--text)]">
                  {activeCategory
                    ? EXPERTISE_CATEGORIES.find(c => c.id === activeCategory)?.label
                    : 'Tous les modèles'}
                  <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
                    {activeCount} documents
                  </span>
                </h2>
              </div>
            )}

            {search.trim() !== '' && (
              <p className="text-xs text-[var(--text-secondary)]">
                {visibleDocs.length} résultat{visibleDocs.length > 1 ? 's' : ''} pour « {search} »
              </p>
            )}

            {visibleDocs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
                <Search size={28} className="mx-auto mb-3 text-[var(--text-secondary)]" />
                <p className="text-sm font-medium text-[var(--text)]">Aucun document trouvé</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Essayez un autre terme de recherche.</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleDocs.map(doc => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onSelect={() => handleSelectDoc(doc)}
                  selected={selectedDoc?.id === doc.id}
                />
              ))}
            </div>

            {/* Historique catégorie */}
            {activeCategory && historique.filter(h => h.categorie === activeCategory).length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Déjà générés dans cette catégorie</p>
                <div className="space-y-1">
                  {historique.filter(h => h.categorie === activeCategory).slice(0, 5).map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                      <Clock size={11} className="text-[var(--text-secondary)] shrink-0" />
                      <p className="text-xs text-[var(--text)] truncate flex-1">{doc.titre}</p>
                      <span className="text-[10px] text-[var(--text-secondary)] shrink-0">
                        {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Colonne formulaire */}
          <div className="lg:col-span-2">
            {selectedDoc ? (
              <div className="sticky top-4">
                <GenerationForm
                  doc={selectedDoc}
                  pays={pays}
                  onPaysChange={setPays}
                  onGenerate={handleGenerate}
                  generating={generating}
                  result={result}
                  onClose={() => { setResult(null); setSelectedDoc(null) }}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center sticky top-4">
                <Sparkles size={28} className="mx-auto mb-3" style={{ color: '#F59E0B' }} />
                <p className="text-sm font-medium text-[var(--text)]">Sélectionnez un document</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Choisissez un modèle dans la liste pour configurer et générer votre document avec MIAA+.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
