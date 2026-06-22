'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { GraduationCap, CheckCircle, XCircle, Loader2, ShieldCheck } from 'lucide-react'

interface DiplomaResult {
  etudiant_nom: string
  type_diplome: string
  intitule: string
  mention: string | null
  annee_obtention: number
  date_emission: string | null
  statut: string
  numero_diplome: string | null
  est_valide: boolean
}

export default function VerifyDiplomePage() {
  const { code } = useParams<{ code: string }>()
  const [result,  setResult]  = useState<DiplomaResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [found,   setFound]   = useState(false)

  useEffect(() => {
    if (!code) { setLoading(false); return }
    supabase.rpc('fn_verifier_diplome', { p_code: code })
      .then(({ data }) => {
        const rows = (data ?? []) as DiplomaResult[]
        if (rows.length > 0) { setResult(rows[0]); setFound(true) }
        setLoading(false)
      })
  }, [code])

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#F8FAFC' }}>
      <div className="w-full max-w-md">

        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: 'rgba(37,99,235,0.1)' }}>
            <ShieldCheck size={28} style={{ color: '#2563EB' }} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
            Vérification de Diplôme
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            Authentification officielle du titre académique
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden"
          style={{ borderColor: '#E2E8F0' }}>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="animate-spin" style={{ color: '#2563EB' }} />
              <p style={{ fontSize: 13, color: '#64748B' }}>Vérification en cours…</p>
            </div>

          ) : !found ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
              <XCircle size={40} style={{ color: '#DC2626' }} />
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Diplôme introuvable</p>
              <p style={{ fontSize: 13, color: '#64748B' }}>
                Ce code de vérification ne correspond à aucun diplôme dans notre registre.
                Il est peut-être invalide ou le diplôme a été révoqué.
              </p>
            </div>

          ) : result && (
            <>
              {/* Status banner */}
              <div className="px-5 py-4 flex items-center gap-3"
                style={{ background: result.est_valide ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)' }}>
                {result.est_valide
                  ? <CheckCircle size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                  : <XCircle    size={20} style={{ color: '#DC2626', flexShrink: 0 }} />
                }
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: result.est_valide ? '#16A34A' : '#DC2626' }}>
                    {result.est_valide ? 'Diplôme authentique et valide' : 'Diplôme non valide'}
                  </p>
                  <p style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                    Statut : {result.statut}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="px-5 py-5 space-y-4">

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(37,99,235,0.08)' }}>
                    <GraduationCap size={18} style={{ color: '#2563EB' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{result.etudiant_nom}</p>
                    <p style={{ fontSize: 12, color: '#64748B' }}>Titulaire du diplôme</p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
                  <Row label="Diplôme"   value={result.type_diplome} />
                  <Row label="Intitulé"  value={result.intitule} />
                  <Row label="Promotion" value={String(result.annee_obtention)} />
                  {result.mention && <Row label="Mention" value={result.mention} highlight />}
                  {result.numero_diplome && <Row label="N° Diplôme" value={result.numero_diplome} mono />}
                  {result.date_emission && (
                    <Row label="Délivré le"
                      value={new Date(result.date_emission).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} />
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t" style={{ borderColor: '#F1F5F9', background: '#F8FAFC' }}>
                <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                  Vérification automatique · Code : {typeof code === 'string' ? code.slice(0, 8) : ''}…
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, highlight, mono }: {
  label: string; value: string; highlight?: boolean; mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span style={{ fontSize: 12, color: '#64748B', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 12,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? '#16A34A' : '#0F172A',
        fontFamily: mono ? 'monospace' : undefined,
        textAlign: 'right',
      }}>{value}</span>
    </div>
  )
}
