'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, Send, Printer, ZoomIn, ZoomOut,
  ArrowLeft, Loader2, Check, AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { calculerTVACongo } from '@/lib/fiscalite-congo'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Facture {
  id: string
  invoice_number: string | null
  client_name: string | null
  client_nom: string | null
  client_address: string | null
  client_phone: string | null
  client_email: string | null
  date: string | null
  due_date: string | null
  subtotal: number | null
  montant_ht: number | null
  statut: string | null
  notes: string | null
  items: Array<{ description: string; prix_unitaire: number; quantite: number }> | null
  created_at: string
}

interface Ligne {
  description: string
  price: number
  quantity: number
  total: number
}

interface Config {
  nom: string | null
  logo_url: string | null
  adresse: string | null
  telephone: string | null
  email: string | null
  ville: string | null
  pays: string | null
  rccm: string | null
  sciet: string | null
  scien: string | null
  capital: string | null
  rib: string | null
  message_defaut: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'BROUILLON', color: '#8B949E', bg: '#8B949E20' },
  envoyee:   { label: 'ENVOYÉE',   color: '#DC2626', bg: '#DC262620' },
  envoye:    { label: 'ENVOYÉE',   color: '#DC2626', bg: '#DC262620' },
  payee:     { label: 'PAYÉE',     color: '#2EA043', bg: '#2EA04320' },
  retard:    { label: 'EN RETARD', color: '#DC2626', bg: '#DC262620' },
  annulee:   { label: 'ANNULÉE',  color: '#64748B', bg: '#48495820' },
}

const GOLD = '#DC2626'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoicePreviewPage() {
  const { id }         = useParams<{ id: string }>()
  const router         = useRouter()
  const { tenantId }   = useTenant()

  const [facture,     setFacture]     = useState<Facture | null>(null)
  const [lignes,      setLignes]      = useState<Ligne[]>([])
  const [config,      setConfig]      = useState<Config | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [zoom,        setZoom]        = useState(1.0)
  const [downloading, setDownloading] = useState(false)
  const [sending,     setSending]     = useState(false)
  const [sent,        setSent]        = useState(false)

  const paperRef = useRef<HTMLDivElement>(null)

  // ── Data fetch ───────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!id || !tenantId) return
    const [{ data: f }, { data: ls }, { data: cfg }] = await Promise.all([
      supabase.from('factures').select('*').eq('id', id).single(),
      supabase.from('facture_lignes').select('*').eq('invoice_id', id).order('id'),
      supabase.from('entreprise_config').select('*').eq('tenant_id', tenantId).maybeSingle(),
    ])
    if (f) {
      setFacture(f as Facture)
      if (ls && ls.length > 0) {
        setLignes(ls as Ligne[])
      } else if ((f as Facture).items) {
        setLignes(
          ((f as Facture).items ?? []).map(it => ({
            description: it.description,
            price: it.prix_unitaire,
            quantity: it.quantite,
            total: it.prix_unitaire * it.quantite,
          }))
        )
      }
    }
    if (cfg) setConfig(cfg as Config)
    setLoading(false)
  }, [id, tenantId])

  useEffect(() => { load() }, [load])

  // ── Derived values ────────────────────────────────────────────────────────────

  const subtotal   = facture?.subtotal ?? facture?.montant_ht ?? 0
  const { tva, ca, ttc } = calculerTVACongo(subtotal)
  const invoiceNum = facture?.invoice_number ?? facture?.id?.slice(0, 8).toUpperCase() ?? '---'
  const clientName = facture?.client_name ?? facture?.client_nom ?? 'Client'
  const statut     = facture?.statut ?? 'brouillon'
  const statutCfg  = STATUT_CFG[statut] ?? STATUT_CFG.brouillon
  const companyLetter = (config?.nom ?? 'O').charAt(0).toUpperCase()

  // ── Download PDF ─────────────────────────────────────────────────────────────

  async function handleDownload() {
    if (!paperRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF }   = await import('jspdf')
      const canvas = await html2canvas(paperRef.current, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff',
      })
      const pdf = new jsPDF('p', 'mm', 'a4')
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0,
        pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight())
      pdf.save(`facture-${invoiceNum}.pdf`)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!facture) return
    setSending(true)
    try {
      const res = await fetch('/api/invoice/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: facture.id }),
      })
      if (res.ok) {
        setSent(true)
        setFacture(f => f ? { ...f, statut: 'envoye' } : f)
        setTimeout(() => setSent(false), 3500)
      }
    } finally {
      setSending(false)
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────────

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-[var(--surface)] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#DC2626]" size={32} />
    </div>
  )

  if (!facture) return (
    <div className="fixed inset-0 z-50 bg-[var(--surface)] flex flex-col items-center justify-center gap-4">
      <AlertTriangle size={40} className="text-red-400" />
      <p className="text-[#101729] font-semibold">Facture introuvable</p>
      <button onClick={() => router.back()} className="text-sm text-[var(--text-secondary)] hover:text-[#101729]">← Retour</button>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Print: only paper is visible */}
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #invoice-paper, #invoice-paper * { visibility: visible !important; }
          #invoice-paper {
            position: fixed !important; inset: 0 !important;
            width: 210mm !important; min-height: 297mm !important;
            margin: 0 !important; box-shadow: none !important;
            transform: none !important;
          }
          #preview-bar { display: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 bg-[var(--surface)] flex flex-col">

        {/* ── TOP ACTION BAR ────────────────────────────────────────────────── */}
        <div id="preview-bar" className="h-14 shrink-0 flex items-center px-4 gap-3 border-b border-white/[0.06]" style={{ background: '#0f1e3d' }}>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-white text-sm transition-colors shrink-0">
            <ArrowLeft size={15} /> Retour
          </button>
          <div className="h-4 w-px bg-white/10 shrink-0" />

          {/* Identity */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-bold text-white font-mono shrink-0">{invoiceNum}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: statutCfg.color, background: statutCfg.bg }}>
              {statutCfg.label}
            </span>
            <span className="text-xs text-[var(--text-secondary)] truncate hidden sm:block">· {clientName}</span>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-1 py-1 shrink-0">
            <button onClick={() => setZoom(z => Math.max(0.4, parseFloat((z - 0.1).toFixed(1))))} className="p-1 rounded text-[var(--text-secondary)] hover:text-white transition-colors"><ZoomOut size={14} /></button>
            <button onClick={() => setZoom(1.0)} className="text-xs text-[var(--text-secondary)] hover:text-white px-2 font-mono w-10 text-center transition-colors">{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom(z => Math.min(2.0, parseFloat((z + 0.1).toFixed(1))))} className="p-1 rounded text-[var(--text-secondary)] hover:text-white transition-colors"><ZoomIn size={14} /></button>
          </div>
          <div className="h-4 w-px bg-white/10 shrink-0" />

          {/* Print */}
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-[var(--text-secondary)] hover:text-white text-xs transition-colors shrink-0">
            <Printer size={13} /> Imprimer
          </button>

          {/* Send */}
          <motion.button onClick={handleSend} disabled={sending || sent} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 shrink-0"
            style={{ background: sent ? '#2EA04320' : '#DC262615', color: sent ? '#2EA043' : '#DC2626', border: `1px solid ${sent ? '#2EA04340' : '#DC262630'}` }}
          >
            {sending ? <Loader2 className="animate-spin" size={13} /> : sent ? <Check size={13} /> : <Send size={13} />}
            {sent ? 'Envoyée !' : 'Envoyer'}
          </motion.button>

          {/* Download */}
          <motion.button onClick={handleDownload} disabled={downloading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60 shrink-0"
            style={{ background: `#d4880a`, color: '#0F172A' }}
          >
            {downloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            <span className="hidden sm:inline">Télécharger PDF</span>
            <span className="sm:hidden">PDF</span>
          </motion.button>
        </div>

        {/* ── SCROLL AREA ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          <div className="flex justify-center"
            style={{ padding: '48px 24px', minWidth: `${794 * zoom + 48}px`, minHeight: `${1123 * zoom + 96}px` }}
          >
            {/* Zoom wrapper */}
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', flexShrink: 0, width: 794 }}>

              {/* ════════════ A4 PAPER ════════════ */}
              <div ref={paperRef} id="invoice-paper" className="bg-white relative"
                style={{ width: 794, minHeight: 1123, boxShadow: '0 24px 72px rgba(0,0,0,0.55), 0 6px 20px rgba(0,0,0,0.3)', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
              >
                {/* Draft watermark */}
                {statut === 'brouillon' && (
                  <div style={{ position: 'absolute', top: '38%', left: '8%', transform: 'rotate(-35deg)', fontSize: 110, fontWeight: 900, color: 'rgba(255,0,0,0.055)', pointerEvents: 'none', userSelect: 'none', letterSpacing: 6 }}>
                    BROUILLON
                  </div>
                )}

                <div style={{ padding: '44px 52px 48px' }}>

                  {/* ── HEADER ────────────────────────────────────────────── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    {/* Left: Logo + Company */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      {config?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={config.logo_url} alt="Logo" crossOrigin="anonymous"
                          style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 52, height: 52, background: GOLD, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: '#0F172A', fontWeight: 900, fontSize: 24 }}>{companyLetter}</span>
                        </div>
                      )}
                      <div>
                        <p style={{ fontSize: 17, fontWeight: 900, color: '#111', margin: 0, letterSpacing: 0.3 }}>{config?.nom ?? 'oraforme'}</p>
                        {(config?.ville || config?.pays) && (
                          <p style={{ fontSize: 10, color: '#6B7280', margin: '3px 0 0' }}>{config?.ville ?? ''}{config?.pays ? `, ${config.pays}` : ''}</p>
                        )}
                        <p style={{ fontSize: 10, color: '#9CA3AF', margin: '3px 0 0' }}>
                          {facture.date ? fmtDate(facture.date) : fmtDate(facture.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Right: INVOICE title */}
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 42, fontWeight: 900, color: '#111', margin: 0, letterSpacing: 4, textTransform: 'uppercase' }}>INVOICE</p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0', fontWeight: 500 }}>#{invoiceNum}</p>
                      {/* Status pill */}
                      <div style={{ marginTop: 10, display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: statutCfg.bg, color: statutCfg.color, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>
                        {statutCfg.label}
                      </div>
                    </div>
                  </div>

                  {/* Separator */}
                  <div style={{ height: 1, background: '#E5E7EB', marginBottom: 24 }} />

                  {/* ── INVOICE TO + INFO BOX ─────────────────────────────── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                    {/* Client */}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: 1.5, margin: '0 0 10px' }}>Invoice To :</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>{clientName}</p>
                      {facture.client_address && <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', lineHeight: 1.5 }}>{facture.client_address}</p>}
                      {facture.client_phone   && <p style={{ fontSize: 11, color: '#6B7280', margin: '3px 0 0' }}>{facture.client_phone}</p>}
                      {facture.client_email   && <p style={{ fontSize: 11, color: '#6B7280', margin: '3px 0 0' }}>{facture.client_email}</p>}
                    </div>

                    {/* Info box with gold left border */}
                    <div style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: 22, minWidth: 210 }}>
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 9, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Invoice Number</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>{invoiceNum}</p>
                      </div>
                      <div style={{ marginBottom: facture.due_date ? 14 : 0 }}>
                        <p style={{ fontSize: 9, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Date</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>
                          {facture.date ? fmtDate(facture.date) : fmtDate(facture.created_at)}
                        </p>
                      </div>
                      {facture.due_date && (
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Due Date</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>{fmtDate(facture.due_date)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── ITEMS TABLE ───────────────────────────────────────── */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 36, fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: GOLD }}>
                        <th style={{ width: '6%',  padding: '12px 12px', color: '#fff', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>No</th>
                        <th style={{ width: '44%', padding: '12px 14px', color: '#fff', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>Item Description</th>
                        <th style={{ width: '18%', padding: '12px 14px', color: '#fff', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Price</th>
                        <th style={{ width: '10%', padding: '12px 14px', color: '#fff', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Qty</th>
                        <th style={{ width: '22%', padding: '12px 14px', color: '#fff', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.length === 0 && (
                        <tr style={{ background: '#fff' }}>
                          <td colSpan={5} style={{ padding: '20px 14px', textAlign: 'center', color: '#9CA3AF', fontStyle: 'italic', fontSize: 11 }}>Aucune ligne</td>
                        </tr>
                      )}
                      {lignes.map((l, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '11px 12px', color: '#9CA3AF', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>
                            {String(i + 1).padStart(2, '0')}
                          </td>
                          <td style={{ padding: '11px 14px', color: '#111', fontSize: 12, fontWeight: 500 }}>{l.description}</td>
                          <td style={{ padding: '11px 14px', color: '#374151', textAlign: 'right', fontSize: 11 }}>{fmt(l.price)} FCFA</td>
                          <td style={{ padding: '11px 14px', color: '#374151', textAlign: 'center', fontSize: 11 }}>{l.quantity}</td>
                          <td style={{ padding: '11px 14px', color: '#111', fontWeight: 700, textAlign: 'right', fontSize: 12 }}>{fmt(l.total)} FCFA</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* ── FOOTER SECTION ────────────────────────────────────── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40, marginBottom: 32 }}>
                    {/* Left: Payment method + Terms */}
                    <div style={{ flex: 1 }}>
                      {config?.rib && (
                        <div style={{ marginBottom: 18 }}>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px' }}>Payment Method</p>
                          <p style={{ fontSize: 10, color: '#374151', lineHeight: 1.7, margin: 0 }}>{config.rib}</p>
                        </div>
                      )}

                      {(config?.rccm || config?.sciet || config?.scien || config?.capital) && (
                        <div style={{ marginBottom: facture.notes ? 18 : 0 }}>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px' }}>Terms &amp; Conditions</p>
                          <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.7 }}>
                            {config?.rccm    && <p style={{ margin: 0 }}>RCCM : {config.rccm}</p>}
                            {config?.sciet   && <p style={{ margin: 0 }}>SCIET : {config.sciet}</p>}
                            {config?.scien   && <p style={{ margin: 0 }}>SCIEN : {config.scien}</p>}
                            {config?.capital && <p style={{ margin: 0 }}>Capital : {config.capital} FCFA</p>}
                          </div>
                        </div>
                      )}

                      {facture.notes && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 6px' }}>Notes</p>
                          <p style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{facture.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Right: Totals */}
                    <div style={{ width: 260, flexShrink: 0 }}>
                      {[
                        { label: 'Sub Total',    value: fmt(subtotal) + ' FCFA' },
                        { label: 'TVA (18 %)',   value: fmt(tva)      + ' FCFA' },
                        { label: 'CA (5% TVA)',  value: fmt(ca)       + ' FCFA' },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #F3F4F6' }}>
                          <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>{row.label}</span>
                          <span style={{ fontSize: 11, color: '#111', fontWeight: 600 }}>{row.value}</span>
                        </div>
                      ))}
                      {/* Grand Total — gold full-width row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: GOLD, marginTop: 2 }}>
                        <span style={{ fontSize: 12, color: '#fff', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>Grand Total :</span>
                        <span style={{ fontSize: 13, color: '#fff', fontWeight: 900 }}>{fmt(ttc)} FCFA</span>
                      </div>
                    </div>
                  </div>

                  {/* ── SIGNATURE + THANK YOU ─────────────────────────────── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: 22 }}>
                    {/* Signature */}
                    <div>
                      <div style={{ borderBottom: '1.5px solid #374151', width: 150, marginBottom: 8 }} />
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#111', margin: 0 }}>{config?.nom ?? 'Signature'}</p>
                      <p style={{ fontSize: 10, color: '#6B7280', margin: '3px 0 0' }}>Représentant autorisé</p>
                    </div>

                    {/* Thank you + contact */}
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 15, fontWeight: 900, color: GOLD, margin: '0 0 10px', fontStyle: 'italic' }}>
                        {config?.message_defaut ?? 'Merci pour votre confiance !'}
                      </p>
                      <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end' }}>
                        {config?.telephone && (
                          <span style={{ fontSize: 10, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                            📞 {config.telephone}
                          </span>
                        )}
                        {config?.email && (
                          <span style={{ fontSize: 10, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                            ✉ {config.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>{/* end content padding */}
              </div>{/* end A4 paper */}
            </div>{/* end zoom wrapper */}
          </div>
        </div>{/* end scroll area */}

        {/* ── SENT TOAST ────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {sent && (
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl"
              style={{ background: '#2EA043', color: '#fff', zIndex: 9999 }}
            >
              <Check size={16} /> Facture marquée comme envoyée !
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
