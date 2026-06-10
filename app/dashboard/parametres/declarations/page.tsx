'use client'

import { usePays } from '@/lib/contexts/PaysContext'
import { useLocale } from '@/lib/hooks/useLocale'
import { Calendar, AlertTriangle, CheckCircle2, Clock, ChevronLeft, FileText, DollarSign, Users } from 'lucide-react'
import Link from 'next/link'

interface DeclarationItem {
  code: string
  nom: string
  echeance: string
  statut: 'urgent' | 'proche' | 'ok'
  type: 'tva' | 'cnss' | 'irpp' | 'is' | 'autre'
}

function getEcheanceLabel(jour: number, moisSuivant: boolean): string {
  const now = new Date()
  const year = now.getFullYear()
  const mois = moisSuivant ? now.getMonth() + 1 : now.getMonth()
  const date = new Date(year, mois, jour)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function getDaysUntil(jour: number, moisSuivant: boolean): number {
  const now = new Date()
  const year = now.getFullYear()
  const mois = moisSuivant ? now.getMonth() + 1 : now.getMonth()
  const date = new Date(year, mois, jour)
  return Math.ceil((date.getTime() - now.getTime()) / 86400000)
}

function getStatut(days: number): 'urgent' | 'proche' | 'ok' {
  if (days <= 5) return 'urgent'
  if (days <= 15) return 'proche'
  return 'ok'
}

export default function DeclarationsPage() {
  const { paysFiscal, paysGeo } = usePays()
  const { t } = useLocale()

  const declarations: DeclarationItem[] = []

  // TVA mensuelle
  if (paysFiscal.tva.regime === 'mensuel') {
    const days = getDaysUntil(paysFiscal.tva.echeance_jour, paysFiscal.tva.echeance_mois_suivant)
    declarations.push({
      code: 'TVA',
      nom: `Déclaration TVA ${(paysFiscal.tva.taux_normal * 100).toFixed(1)}%${paysFiscal.tva.taxes_additionnelles?.length ? ` + ${paysFiscal.tva.taxes_additionnelles[0].code}` : ''}`,
      echeance: getEcheanceLabel(paysFiscal.tva.echeance_jour, paysFiscal.tva.echeance_mois_suivant),
      statut: getStatut(days),
      type: 'tva',
    })
  } else if (paysFiscal.tva.regime === 'trimestriel') {
    const days = getDaysUntil(paysFiscal.tva.echeance_jour, true)
    declarations.push({
      code: 'TVA',
      nom: `Déclaration TVA trimestrielle ${(paysFiscal.tva.taux_normal * 100).toFixed(1)}%`,
      echeance: getEcheanceLabel(paysFiscal.tva.echeance_jour, true),
      statut: getStatut(days),
      type: 'tva',
    })
  }

  // CNSS / charges sociales
  {
    const days = getDaysUntil(paysFiscal.cnss.echeance_jour, paysFiscal.cnss.echeance_mois_suivant)
    declarations.push({
      code: paysFiscal.cnss.acronyme,
      nom: `${paysFiscal.cnss.nom} — Salarié ${(paysFiscal.cnss.taux_salarie * 100).toFixed(1)}% · Patronal ${(paysFiscal.cnss.taux_patronal * 100).toFixed(1)}%`,
      echeance: getEcheanceLabel(paysFiscal.cnss.echeance_jour, paysFiscal.cnss.echeance_mois_suivant),
      statut: getStatut(days),
      type: 'cnss',
    })
  }

  // IRPP / retenue à la source sur salaires
  {
    const days = getDaysUntil(paysFiscal.irpp.echeance_jour, true)
    declarations.push({
      code: paysFiscal.irpp.nom.split(' ')[0],
      nom: paysFiscal.irpp.nom,
      echeance: getEcheanceLabel(paysFiscal.irpp.echeance_jour, true),
      statut: getStatut(days),
      type: 'irpp',
    })
  }

  // Taxes annuelles
  const currentMonth = new Date().getMonth() + 1
  for (const tax of paysFiscal.taxes_annuelles) {
    const diff = (tax.echeance_mois - currentMonth + 12) % 12
    const daysUntil = diff * 30 + tax.echeance_jour
    declarations.push({
      code: tax.code,
      nom: tax.nom,
      echeance: `${tax.echeance_jour.toString().padStart(2, '0')}/${tax.echeance_mois.toString().padStart(2, '0')} de chaque année`,
      statut: diff === 0 ? getStatut(tax.echeance_jour - new Date().getDate()) : 'ok',
      type: 'is',
    })
  }

  const urgents = declarations.filter(d => d.statut === 'urgent')
  const proches = declarations.filter(d => d.statut === 'proche')
  const ok = declarations.filter(d => d.statut === 'ok')

  const typeIcon = {
    tva: DollarSign,
    cnss: Users,
    irpp: FileText,
    is: FileText,
    autre: FileText,
  }

  const typeColor = {
    tva: '#2563EB',
    cnss: '#16A34A',
    irpp: '#F59E0B',
    is: '#DC2626',
    autre: '#64748B',
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres"
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
          <ChevronLeft size={16} /> {t('common.back')}
        </Link>
      </div>

      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F59E0B20' }}>
          <Calendar size={18} style={{ color: '#F59E0B' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Calendrier Fiscal</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {paysGeo.drapeau} {paysGeo.nom} · {paysGeo.devise} · {paysFiscal.systeme_comptable}
          </p>
        </div>
      </div>

      {/* Notes importantes */}
      {paysFiscal.notes_importantes.length > 0 && (
        <div className="rounded-xl border p-4 space-y-1.5" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <p className="text-xs font-bold text-[#92400E] uppercase tracking-wider mb-2">Informations clés</p>
          {paysFiscal.notes_importantes.map((note, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#F59E0B] mt-0.5 shrink-0">•</span>
              <p className="text-xs text-[#92400E]">{note}</p>
            </div>
          ))}
        </div>
      )}

      {/* Urgentes */}
      {urgents.length > 0 && (
        <section>
          <p className="text-xs font-bold text-[#DC2626] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Échéances imminentes (&le;5 jours)
          </p>
          <div className="space-y-2">
            {urgents.map(d => <DeclarationCard key={d.code} d={d} typeIcon={typeIcon} typeColor={typeColor} />)}
          </div>
        </section>
      )}

      {/* Proches */}
      {proches.length > 0 && (
        <section>
          <p className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock size={12} /> Prochaines échéances (&le;15 jours)
          </p>
          <div className="space-y-2">
            {proches.map(d => <DeclarationCard key={d.code} d={d} typeIcon={typeIcon} typeColor={typeColor} />)}
          </div>
        </section>
      )}

      {/* Ok */}
      {ok.length > 0 && (
        <section>
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> Planifiées
          </p>
          <div className="space-y-2">
            {ok.map(d => <DeclarationCard key={d.code} d={d} typeIcon={typeIcon} typeColor={typeColor} />)}
          </div>
        </section>
      )}

      {/* Tranches IRPP */}
      <section>
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2" style={{ background: '#F9FAFB' }}>
            <FileText size={13} style={{ color: '#F59E0B' }} />
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Barème {paysFiscal.irpp.nom}
            </span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {paysFiscal.irpp.tranches.map((tr, i) => (
              <div key={i} className="px-4 py-2 flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">
                  {tr.min === 0 ? '0' : tr.min.toLocaleString('fr-FR')} – {tr.max === Infinity ? '∞' : tr.max.toLocaleString('fr-FR')} {paysGeo.devise}
                </span>
                <span className="font-medium" style={{ color: tr.taux === 0 ? '#16A34A' : '#DC2626' }}>
                  {(tr.taux * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function DeclarationCard({
  d, typeIcon, typeColor,
}: {
  d: DeclarationItem
  typeIcon: Record<string, React.ElementType>
  typeColor: Record<string, string>
}) {
  const Icon = typeIcon[d.type] ?? FileText
  const color = typeColor[d.type] ?? '#64748B'
  const statusStyles = {
    urgent: { bg: '#FEF2F2', border: '#FECACA', dot: '#DC2626' },
    proche: { bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
    ok: { bg: 'var(--surface)', border: 'var(--border)', dot: '#16A34A' },
  }
  const s = statusStyles[d.statut]

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ background: s.bg, borderColor: s.border }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: color + '18' }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white" style={{ background: color }}>{d.code}</span>
          <span className="text-[11px] font-medium text-[var(--text)] truncate">{d.nom}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
          <span className="text-[11px] text-[var(--text-secondary)]">Échéance : {d.echeance}</span>
        </div>
      </div>
    </div>
  )
}
