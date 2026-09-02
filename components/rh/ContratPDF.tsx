import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import { calculerChargesSociales, type CodePays } from '@/lib/fiscal/universal-tax-engine'

const AMBER = '#F59E0B'
const DARK  = '#0F172A'
const GRAY  = '#64748B'
const LIGHT = '#F8FAFC'
const BORDER= '#E2E8F0'

const s = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 10, color: DARK, padding: '30 40' },
  header:    { marginBottom: 24, borderBottom: `2 solid ${AMBER}`, paddingBottom: 12 },
  title:     { fontSize: 16, fontFamily: 'Helvetica-Bold', color: AMBER, marginBottom: 2 },
  subtitle:  { fontSize: 9, color: GRAY },
  section:   { marginBottom: 14 },
  sectTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 6, paddingBottom: 3, borderBottom: `1 solid ${BORDER}` },
  article:   { marginBottom: 8 },
  artTitle:  { fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  artText:   { lineHeight: 1.6, color: '#374151' },
  row2:      { flexDirection: 'row', gap: 20, marginTop: 60 },
  signBox:   { flex: 1, borderTop: `2 solid ${DARK}`, paddingTop: 8, textAlign: 'center' as const },
  signLabel: { fontSize: 9, color: GRAY },
  badge:     { fontSize: 8, color: AMBER, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  infogrid:  { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 0 },
  inforow:   { width: '50%', flexDirection: 'row', paddingVertical: 3, borderBottom: `1 solid ${LIGHT}` },
  infolabel: { width: 110, color: GRAY, fontSize: 9 },
  infoval:   { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  recap:     { backgroundColor: LIGHT, padding: '8 12', borderRadius: 4, marginBottom: 12 },
  recapRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  recapKey:  { color: GRAY, fontSize: 9 },
  recapVal:  { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  footer:    { position: 'absolute' as const, bottom: 20, left: 40, right: 40, textAlign: 'center' as const, fontSize: 8, color: '#CBD5E1', borderTop: `1 solid ${BORDER}`, paddingTop: 6 },
})

type TypeContrat = 'cdi' | 'cdd' | 'stage' | 'freelance' | 'vacation' | 'apprentissage'

export interface ContratPDFData {
  id:               string
  type_contrat:     TypeContrat
  date_debut:       string
  date_fin:         string | null
  salaire_base:     number
  primes:           number
  periode_essai:    number
  lieu_travail:     string | null
  description:      string | null
  signe_le:         string | null
  signe_employe:    boolean
  signe_employeur:  boolean
  avantages:        Array<{ type: string; montant?: number; label: string }>
  employe: {
    nom:         string
    poste:       string | null
    matricule:   string | null
    email:       string | null
    telephone:   string | null
    cnss:        string | null
    nationalite: string | null
    adresse:     string | null
  }
  entreprise?: {
    nom:     string
    adresse: string
    ville:   string
  }
  /** Pays du contrat — détermine le barème de cotisations. Congo par défaut. */
  code_pays?: CodePays
}

const LABELS: Record<TypeContrat, string> = {
  cdi:          'DURÉE INDÉTERMINÉE (CDI)',
  cdd:          'DURÉE DÉTERMINÉE (CDD)',
  stage:        'STAGE',
  freelance:    'FREELANCE / PRESTATION',
  vacation:     'VACATION',
  apprentissage:'APPRENTISSAGE',
}

function fmtDate(s?: string | null) {
  if (!s) return 'N/A'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

// Le contrat est opposable au salarié : ses montants doivent être ceux du
// moteur fiscal, pas un taux moyen recopié. La version précédente retenait
// 5,04 % sur la totalité du brut et chiffrait le coût employeur à 14,16 %,
// deux valeurs qui ne correspondent à aucune branche de cotisation et qui
// ignoraient les plafonds.
function chargesContrat(brut: number, codePays: CodePays) {
  const c = calculerChargesSociales({ codePays, salaireBrut: brut, appliquerMesuresSpeciales: false })
  return {
    cnssEmploye:  c.total_salarie,
    netEstime:    brut - c.total_salarie,
    coutPatronal: c.cout_total,
    tauxSalarie:  brut > 0 ? c.total_salarie / brut : 0,
  }
}

export function ContratPDF({ data }: { data: ContratPDFData }) {
  const codePays   = data.code_pays ?? 'CG'
  const charges    = chargesContrat(data.salaire_base, codePays)
  const pctSalarie = `${(charges.tauxSalarie * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} % effectif`
  const { employe, type_contrat, date_debut, date_fin, salaire_base, primes,
          periode_essai, lieu_travail, signe_le, avantages } = data

  const typeLabel = LABELS[type_contrat] ?? type_contrat.toUpperCase()
  const dureeArticle = type_contrat === 'cdi'
    ? 'Le présent contrat est conclu pour une durée indéterminée.'
    : `Le présent contrat est conclu pour une durée déterminée du ${fmtDate(date_debut)} au ${fmtDate(date_fin)}.`

  const avantagesTexte = avantages?.length
    ? avantages.map(a => a.montant ? `${a.label} : ${fmt(a.montant)}/mois` : a.label).join(' · ')
    : null

  return (
    <Document title={`Contrat ${typeLabel} — ${employe.nom}`} author="Oraforme ERP">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.badge}>ORAFORME ERP · RESSOURCES HUMAINES</Text>
          <Text style={s.title}>CONTRAT DE TRAVAIL À {typeLabel}</Text>
          <Text style={s.subtitle}>République du Congo · Code du Travail Congolais · Loi n° 6-96 du 6 mars 1996</Text>
        </View>

        {/* Parties */}
        <View style={s.section}>
          <Text style={s.sectTitle}>ENTRE LES SOUSSIGNÉS</Text>

          <View style={s.recap}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>L&apos;EMPLOYEUR</Text>
            <View style={s.recapRow}>
              <Text style={s.recapKey}>Dénomination sociale</Text>
              <Text style={s.recapVal}>{data.entreprise?.nom ?? '— À compléter —'}</Text>
            </View>
            <View style={s.recapRow}>
              <Text style={s.recapKey}>Adresse du siège</Text>
              <Text style={s.recapVal}>{data.entreprise?.adresse ?? '— À compléter —'}</Text>
            </View>
          </View>

          <Text style={{ marginBottom: 6, fontFamily: 'Helvetica-Bold' }}>ET</Text>

          <View style={s.recap}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>LE SALARIÉ</Text>
            <View style={s.infogrid}>
              {[
                ['Nom complet',   employe.nom],
                ['Poste / Titre', employe.poste ?? '—'],
                ['Matricule',     employe.matricule ?? '—'],
                ['Email',         employe.email ?? '—'],
                ['Téléphone',     employe.telephone ?? '—'],
                ['N° CNSS',       employe.cnss ?? '—'],
                ['Nationalité',   employe.nationalite ?? 'Congolaise'],
                ['Adresse',       employe.adresse ?? '—'],
              ].map(([k, v]) => (
                <View key={k} style={s.inforow}>
                  <Text style={s.infolabel}>{k}</Text>
                  <Text style={s.infoval}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Articles */}
        <View style={s.section}>
          <Text style={s.sectTitle}>CONDITIONS D&apos;EMPLOI</Text>

          <View style={s.article}>
            <Text style={s.artTitle}>ARTICLE 1 — ENGAGEMENT</Text>
            <Text style={s.artText}>
              M./Mme {employe.nom} est engagé(e) en qualité de {employe.poste ?? 'collaborateur'} à
              compter du {fmtDate(date_debut)}.
            </Text>
          </View>

          <View style={s.article}>
            <Text style={s.artTitle}>ARTICLE 2 — DURÉE DU CONTRAT</Text>
            <Text style={s.artText}>{dureeArticle}</Text>
          </View>

          {periode_essai > 0 && (
            <View style={s.article}>
              <Text style={s.artTitle}>ARTICLE 3 — PÉRIODE D&apos;ESSAI</Text>
              <Text style={s.artText}>
                La période d&apos;essai est fixée à {periode_essai} mois à compter de la date de prise
                de service. Durant cette période, chaque partie pourra mettre fin au contrat sans préavis
                ni indemnité conformément au Code du Travail congolais.
              </Text>
            </View>
          )}

          <View style={s.article}>
            <Text style={s.artTitle}>ARTICLE 4 — RÉMUNÉRATION</Text>
            <Text style={s.artText}>
              La rémunération mensuelle brute est fixée à {fmt(salaire_base)}.
              {primes > 0 ? ` Des primes de ${fmt(primes)} par mois peuvent être accordées selon les performances.` : ''}
              {avantagesTexte ? `\nAvantages en nature : ${avantagesTexte}.` : ''}
            </Text>
          </View>

          <View style={s.article}>
            <Text style={s.artTitle}>ARTICLE 5 — LIEU DE TRAVAIL</Text>
            <Text style={s.artText}>
              {lieu_travail
                ? `Le lieu de travail est fixé à : ${lieu_travail}.`
                : 'Le lieu de travail sera précisé par l\'employeur lors de la prise de poste.'}
            </Text>
          </View>

          <View style={s.article}>
            <Text style={s.artTitle}>ARTICLE 6 — DURÉE DU TRAVAIL</Text>
            <Text style={s.artText}>
              La durée légale du travail est de 40 heures par semaine, soit 173,33 heures par mois,
              conformément aux dispositions du Code du Travail de la République du Congo.
            </Text>
          </View>

          <View style={s.article}>
            <Text style={s.artTitle}>ARTICLE 7 — CONGÉS PAYÉS</Text>
            <Text style={s.artText}>
              Le salarié bénéficie de 2,5 jours ouvrables de congés payés par mois de travail effectif,
              soit 26 jours ouvrables par an, conformément à l&apos;article 133 du Code du Travail congolais.
            </Text>
          </View>

          <View style={s.article}>
            <Text style={s.artTitle}>ARTICLE 8 — CONFIDENTIALITÉ</Text>
            <Text style={s.artText}>
              Le salarié s&apos;engage à respecter la confidentialité des informations commerciales, financières
              et stratégiques de l&apos;entreprise, pendant la durée du contrat et après sa cessation,
              sous peine de sanctions disciplinaires et/ou judiciaires.
            </Text>
          </View>

          {data.description && (
            <View style={s.article}>
              <Text style={s.artTitle}>ARTICLE 9 — DISPOSITIONS PARTICULIÈRES</Text>
              <Text style={s.artText}>{data.description}</Text>
            </View>
          )}
        </View>

        {/* Récapitulatif financier */}
        <View style={s.section}>
          <Text style={s.sectTitle}>RÉCAPITULATIF FINANCIER</Text>
          <View style={s.recap}>
            {[
              ['Salaire brut mensuel',           fmt(salaire_base)],
              [`Cotisations salariales (${pctSalarie})`, `- ${fmt(charges.cnssEmploye)}`],
              ['Salaire net estimé',              fmt(charges.netEstime)],
              ['Coût total employeur',            fmt(charges.coutPatronal)],
            ].map(([k, v]) => (
              <View key={k} style={s.recapRow}>
                <Text style={s.recapKey}>{k}</Text>
                <Text style={s.recapVal}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Signatures */}
        <View style={s.article}>
          <Text style={s.artText}>
            Fait à {data.entreprise?.ville ?? '___________'}, le {fmtDate(signe_le ?? new Date().toISOString())},
            en deux (2) exemplaires originaux, dont un est remis à chaque partie.
          </Text>
        </View>

        <View style={s.row2}>
          <View style={s.signBox}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>L&apos;Employeur</Text>
            <Text style={s.signLabel}>{data.entreprise?.nom ?? '— Cachet & signature —'}</Text>
            <Text style={{ ...s.signLabel, marginTop: 30 }}>Lu et approuvé</Text>
          </View>
          <View style={s.signBox}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>{employe.nom}</Text>
            <Text style={s.signLabel}>{employe.poste ?? 'Le Salarié'}</Text>
            <Text style={{ ...s.signLabel, marginTop: 30 }}>Lu et approuvé</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={s.footer}>
          Document généré par Oraforme ERP · {new Date().toLocaleDateString('fr-FR')} · Confidentiel
        </Text>
      </Page>
    </Document>
  )
}
