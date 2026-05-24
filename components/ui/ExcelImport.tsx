'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download, X } from 'lucide-react'

export interface ImportColumn {
  key: string
  label: string
  required?: boolean
  type?: 'text' | 'number' | 'date' | 'email' | 'phone'
  example?: string
}

export interface ImportResult {
  success: number
  errors: { row: number; message: string }[]
  data: Record<string, string | number | null>[]
}

interface ExcelImportProps {
  title: string
  description?: string
  columns: ImportColumn[]
  onImport: (rows: Record<string, string | number | null>[]) => Promise<ImportResult>
  templateName?: string
}

function parseCSV(text: string, columns: ImportColumn[]): Record<string, string | number | null>[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  const rows: Record<string, string | number | null>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string | number | null> = {}

    columns.forEach(col => {
      const idx = header.findIndex(h =>
        h === col.key.toLowerCase() ||
        h === col.label.toLowerCase() ||
        h.includes(col.key.toLowerCase())
      )
      if (idx >= 0) {
        const val = values[idx] ?? ''
        if (col.type === 'number') {
          row[col.key] = val === '' ? null : Number(val.replace(/\s/g, '').replace(',', '.'))
        } else {
          row[col.key] = val === '' ? null : val
        }
      } else {
        row[col.key] = null
      }
    })

    if (Object.values(row).some(v => v !== null && v !== '')) {
      rows.push(row)
    }
  }

  return rows
}

function generateCSVTemplate(columns: ImportColumn[]): string {
  const header = columns.map(c => c.key).join(',')
  const example = columns.map(c => c.example ?? (c.type === 'number' ? '0' : 'Exemple')).join(',')
  return `${header}\n${example}`
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type Step = 'idle' | 'preview' | 'importing' | 'done' | 'error'

export default function ExcelImport({ title, description, columns, onImport, templateName }: ExcelImportProps) {
  const [step, setStep] = useState<Step>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string | number | null>[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (f: File) => {
    setFile(f)
    const text = await f.text()
    const rows = parseCSV(text, columns)
    setPreview(rows.slice(0, 5))
    setStep('preview')
  }, [columns])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx'))) processFile(f)
  }, [processFile])

  const handleImport = async () => {
    if (!file) return
    setStep('importing')
    const text = await file.text()
    const rows = parseCSV(text, columns)
    const res = await onImport(rows)
    setResult(res)
    setStep('done')
  }

  const reset = () => {
    setStep('idle')
    setFile(null)
    setPreview([])
    setResult(null)
  }

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-[var(--text)]">{title}</h3>
          {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>}
        </div>
        <button
          onClick={() => downloadCSV(generateCSVTemplate(columns), templateName ?? 'modele.csv')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[#64748B] transition-all"
        >
          <Download size={12} /> Modèle CSV
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP: IDLE — Drop Zone */}
        {step === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-[#DC2626] bg-[#DC262608]'
                : 'border-[var(--border)] hover:border-[#64748B] hover:bg-white/5'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={e => e.target.files?.[0] && processFile(e.target.files[0])}
            />
            <div className="flex flex-col items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                dragging ? 'bg-[#DC262620]' : 'bg-[var(--surface-alt)]'
              }`}>
                <Upload size={24} className={dragging ? 'text-[#DC2626]' : 'text-[var(--text-secondary)]'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {dragging ? 'Relâchez pour charger' : 'Glissez votre fichier ici'}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">CSV ou Excel · max 10 MB</p>
              </div>
              <span className="text-xs text-[#DC2626] font-semibold border border-[#DC262630] px-3 py-1 rounded-full">
                ou cliquez pour parcourir
              </span>
            </div>
          </motion.div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet size={15} className="text-[#16A34A]" />
              <span className="text-xs text-[var(--text)] font-medium">{file?.name}</span>
              <span className="text-xs text-[var(--text-secondary)]">— Aperçu ({preview.length} premières lignes)</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--surface-alt)]">
                    {columns.map(c => (
                      <th key={c.key} className="px-3 py-2 text-left text-[var(--text-secondary)] font-semibold whitespace-nowrap">
                        {c.label}{c.required && <span className="text-[#DC2626] ml-0.5">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t border-[var(--border)] hover:bg-white/5 transition-colors">
                      {columns.map(c => (
                        <td key={c.key} className="px-3 py-2 text-[var(--text)] whitespace-nowrap">
                          {row[c.key] ?? <span className="text-[var(--text-secondary)]">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={reset} className="px-4 py-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg hover:border-[#64748B] transition-all">
                Annuler
              </button>
              <button onClick={handleImport} className="px-5 py-2 text-xs font-bold text-[#DC2626] bg-[#DC2626] rounded-lg hover:bg-[#E09000] transition-all">
                Importer maintenant →
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP: IMPORTING */}
        {step === 'importing' && (
          <motion.div key="importing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <div className="w-12 h-12 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-[var(--text)]">Importation en cours...</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Validation et insertion des données</p>
          </motion.div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && result && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#16A34A15] flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} className="text-[#16A34A]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text)]">{result.success} lignes importées avec succès</p>
                {result.errors.length > 0 && (
                  <p className="text-xs text-[#DC2626] mt-0.5">{result.errors.length} erreur(s) ignorée(s)</p>
                )}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-[#DC262610] border border-[#DC262630] rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-[#DC2626] mb-2">Détails des erreurs :</p>
                {result.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-[#DC2626]">Ligne {e.row} : {e.message}</p>
                ))}
                {result.errors.length > 5 && (
                  <p className="text-xs text-[var(--text-secondary)]">... et {result.errors.length - 5} autres</p>
                )}
              </div>
            )}
            <button onClick={reset} className="w-full py-2 text-xs font-semibold text-[#DC2626] bg-[#DC2626] rounded-xl hover:bg-[#E09000] transition-all">
              Importer un autre fichier
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
