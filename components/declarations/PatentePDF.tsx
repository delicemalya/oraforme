// Composant PDF officiel — Formulaire 721M
// Direction Générale des Impôts et des Domaines — République du Congo
// Rendu via @react-pdf/renderer (server-side)

import {
  Document, Page, View, Text, StyleSheet,
} from '@react-pdf/renderer'

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    padding: 28,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  // Header ministry
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    borderBottom: '1.5pt solid #000',
    paddingBottom: 6,
  },
  headerLeft: { flex: 1, fontSize: 7.5 },
  headerRight: { flex: 1, textAlign: 'right', fontSize: 7.5 },
  headerTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 2 },
  headerSubtitle: { fontSize: 8.5, textAlign: 'center', marginBottom: 1 },

  // Section
  sectionTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    backgroundColor: '#E8E8E8', padding: '3pt 5pt',
    marginTop: 6, marginBottom: 2,
    borderTop: '1pt solid #000', borderBottom: '1pt solid #000',
  },

  // Row in identification
  row: { flexDirection: 'row', marginBottom: 3, alignItems: 'center' },
  label: { fontSize: 7.5, width: 120, color: '#333' },
  value: {
    flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    borderBottom: '0.5pt solid #999', paddingBottom: 1,
    minHeight: 10,
  },
  rowThree: { flexDirection: 'row', gap: 12, marginBottom: 3 },
  col: { flex: 1 },

  // Table
  table: { marginTop: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a', color: '#FFFFFF',
    padding: '3pt 4pt',
  },
  tableHeaderCell: { fontFamily: 'Helvetica-Bold', fontSize: 7, flex: 1 },
  tableHeaderCellNarrow: { fontFamily: 'Helvetica-Bold', fontSize: 7, width: 30 },
  tableHeaderCellWide: { fontFamily: 'Helvetica-Bold', fontSize: 7, flex: 2 },
  tableRow: { flexDirection: 'row', borderBottom: '0.3pt solid #CCC', padding: '2pt 4pt' },
  tableRowAlt: { flexDirection: 'row', borderBottom: '0.3pt solid #CCC', padding: '2pt 4pt', backgroundColor: '#F9F9F9' },
  tableCell: { flex: 1, fontSize: 7.5 },
  tableCellNarrow: { width: 30, fontSize: 7.5 },
  tableCellWide: { flex: 2, fontSize: 7.5 },
  tableCellBold: { flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  tableCellRight: { flex: 1, fontSize: 7.5, textAlign: 'right' },
  tableCellBoldRight: { flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  tableTotalRow: {
    flexDirection: 'row', backgroundColor: '#000',
    padding: '3pt 4pt',
  },
  tableTotalCell: { flex: 1, fontSize: 7.5, color: '#FFF', fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  tableTotalLabel: { flex: 2, fontSize: 7.5, color: '#FFF', fontFamily: 'Helvetica-Bold' },

  // Result box
  resultBox: {
    marginTop: 6, border: '1.5pt solid #000',
    padding: 6, backgroundColor: '#000',
  },
  resultLabel: { color: '#FFF', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  resultValue: { color: '#F59E0B', fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  resultSub: { color: '#CCC', fontSize: 7, fontStyle: 'italic', textAlign: 'right' },

  // Signature
  signatureRow: { flexDirection: 'row', marginTop: 16, gap: 20 },
  signatureBox: { flex: 1, borderTop: '1pt solid #000', paddingTop: 4 },
  signatureLabel: { fontSize: 7.5, color: '#666' },

  // Notes
  notes: { marginTop: 8, fontSize: 6.5, color: '#555', lineHeight: 1.5 },

  // Misc
  smallText: { fontSize: 6.5, color: '#888' },
  bold: { fontFamily: 'Helvetica-Bold' },
  center: { textAlign: 'center' },
  italic: { fontStyle: 'italic' },
  separator: { borderTop: '0.5pt solid #CCC', marginTop: 4, marginBottom: 4 },
  highlight: { backgroundColor: '#FEF3C7', padding: '2pt 4pt' },
})

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeptRow {
  nom: string
  ca: number
  pourcentage: number
}

export interface PatentePDFData {
  annee: number
  // Section A
  niu?: string; scien?: string; rccm?: string
  denomination_sociale?: string; sigle?: string
  adresse?: string; telephone?: string; email?: string
  ville?: string; residence_fiscale?: string
  forme_juridique?: string
  // Section B
  nature_activite?: string
  date_debut_activite?: string
  nb_etablissements?: number
  ca_annuel?: number; ca_exonere?: number; ca_imposable?: number
  taux_applicable?: number; patente_brute?: number
  patente_liquidee?: number
  est_societe_petroliere?: boolean
  montant_reduction?: number; patente_apres_reduction?: number
  centimes_additionnels?: number; camu?: number
  credit_n1?: number; patente_nette?: number
  // Section C
  departements?: DeptRow[]
  // Signature
  lieu_signature?: string; date_signature?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n?: number): string {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}
function pct(n?: number): string {
  if (!n && n !== 0) return '—'
  return `${n.toFixed(2)} %`
}
function fmtDate(d?: string): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
}

const NOTES = [
  '(a) Indiquer les chiffres d\'affaires de l\'exercice précédent celui au titre duquel la contribution est souscrite.',
  '(b) Ne comprend pas les importations en franchise de droits ou les exportations bénéficiant de régime fiscal particulier.',
  '(c) Le centime additionnel est calculé à 5% sur la patente globale liquidée.',
  '(d) La CAMU est calculée à 0,5% sur la patente globale liquidée.',
  '(e) La réduction de 50% ne s\'applique qu\'aux sociétés pétrolières (Art. 314 CGI tome 1).',
  '(f) Le crédit de l\'année N-1 est déduit du montant net à payer.',
  '(g) La répartition par collectivité locale doit totaliser 100% du CA imposable.',
  '(h) En cas de pluralité d\'établissements, déclarer séparément chaque entité.',
  '(i) Pénalités de retard : majoration 10% + intérêts moratoires 5% par mois de retard.',
  '(j) Déclaration à souscrire avant le 20 avril de chaque année en 2 exemplaires.',
]

// ─── Composant principal ──────────────────────────────────────────────────────

export function PatentePDFDocument({ data }: { data: PatentePDFData }) {
  const depts: DeptRow[] = data.departements ?? []

  const lignesB = [
    { n: '1',  label: 'Dénomination / Raison sociale',              valeur: data.denomination_sociale },
    { n: '2',  label: 'Sigle',                                       valeur: data.sigle },
    { n: '3',  label: 'Forme juridique',                             valeur: data.forme_juridique },
    { n: '4',  label: 'Nature d\'activité',                          valeur: data.nature_activite },
    { n: '5',  label: 'Date de début d\'activité',                   valeur: fmtDate(data.date_debut_activite) },
    { n: '6',  label: 'Nombre d\'établissements',                    valeur: data.nb_etablissements?.toString() },
    { n: '7',  label: 'Société pétrolière (réduction 50%)',          valeur: data.est_societe_petroliere ? 'OUI' : 'NON' },
    { n: '8',  label: 'Valeur locative des locaux professionnels',   valeur: `${fmt(0)} FCFA` },
    { n: '9',  label: 'CA de l\'année précédente (a)',               valeur: `${fmt(data.ca_annuel)} FCFA` },
    { n: '10', label: 'CA prévisionnel',                             valeur: '— FCFA' },
    { n: '11', label: 'CA exonéré (b)',                              valeur: `${fmt(data.ca_exonere)} FCFA` },
    { n: '12', label: 'CA imposable (ligne 9 − ligne 11)',           valeur: `${fmt(data.ca_imposable)} FCFA`, bold: true },
    { n: '13', label: 'Taux applicable (barème Art. 235 CGI)',       valeur: data.taux_applicable ? `${(data.taux_applicable * 100).toFixed(1)} %` : '—', bold: true },
    { n: '14', label: 'Patente brute (ligne 12 × ligne 13)',         valeur: `${fmt(data.patente_brute)} FCFA` },
    { n: '15', label: 'Minimum de perception',                       valeur: '50 000 FCFA' },
    { n: '16', label: 'Patente globale liquidée (max. lignes 14/15)',valeur: `${fmt(data.patente_liquidee)} FCFA`, bold: true, highlight: true },
    { n: '17', label: 'Centimes additionnels (ligne 16 × 5%) (c)',   valeur: `${fmt(data.centimes_additionnels)} FCFA` },
    { n: '18', label: 'CAMU (ligne 16 × 0,5%) (d)',                  valeur: `${fmt(data.camu)} FCFA` },
    { n: '19', label: 'Taxe départementale',                         valeur: '0 FCFA' },
    { n: '20', label: 'Patente après réduction 50% (e)',             valeur: `${fmt(data.patente_apres_reduction)} FCFA` },
    { n: '21', label: 'Crédit N-1 à déduire (f)',                    valeur: `${fmt(data.credit_n1)} FCFA` },
    { n: '22', label: 'PATENTE GLOBALE NETTE À PAYER (g)',           valeur: `${fmt(data.patente_nette)} FCFA`, bold: true, big: true },
  ]

  return (
    <Document
      title={`Déclaration Patente 721M — ${data.annee}`}
      author="oraforme · DGID Congo"
      subject={`Contribution de la Patente ${data.annee}`}
      keywords="patente, 721M, DGID, Congo-Brazzaville, contribution"
    >
      <Page size="A4" style={S.page}>

        {/* ── EN-TÊTE MINISTÈRE ────────────────────────────────────────── */}
        <View style={S.headerRow}>
          <View style={S.headerLeft}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8 }}>MINISTÈRE DES FINANCES{'\n'}ET DU BUDGET</Text>
            <Text style={{ marginTop: 2, fontSize: 7 }}>—————————————</Text>
            <Text style={{ fontSize: 7 }}>MINISTRE DÉLÉGUÉ{'\n'}CHARGÉ DU BUDGET</Text>
            <Text style={{ marginTop: 2, fontSize: 7 }}>—————————————</Text>
            <Text style={{ fontSize: 7 }}>DIRECTION GÉNÉRALE{'\n'}DES IMPÔTS ET DES DOMAINES</Text>
            <Text style={{ marginTop: 2, fontSize: 6.5, color: '#555' }}>www.impots.gouv.cg</Text>
          </View>

          <View style={{ flex: 2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>DÉCLARATION DE LA</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>CONTRIBUTION DE LA PATENTE</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, color: '#C00', marginTop: 2 }}>(Formulaire 721M)</Text>
            <Text style={{ fontSize: 8.5, marginTop: 4 }}>AU TITRE DE L'ANNÉE {data.annee}</Text>
            <Text style={{ fontSize: 7, color: '#555', marginTop: 3 }}>A remplir par tous les contribuables soumis au régime du réel</Text>
            <Text style={{ fontSize: 7, color: '#C00' }}>(À souscrire avant le 20 avril en 2 exemplaires)</Text>
          </View>

          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: '#888' }}>République du Congo</Text>
            <Text style={{ fontSize: 7, color: '#888', marginTop: 2 }}>Date réception :</Text>
            <View style={{ border: '1pt solid #999', width: 80, height: 16, marginTop: 2 }} />
            <Text style={{ fontSize: 7, color: '#888', marginTop: 6 }}>N° de déclaration :</Text>
            <View style={{ border: '1pt solid #999', width: 80, height: 16, marginTop: 2 }} />
            <Text style={{ fontSize: 6, color: '#AAA', marginTop: 4 }}>(Réservé à l'administration)</Text>
          </View>
        </View>

        {/* ── SECTION A — IDENTIFICATION ────────────────────────────────── */}
        <Text style={S.sectionTitle}>A — IDENTIFICATION</Text>

        <View style={S.rowThree}>
          <View style={S.col}>
            <Text style={{ fontSize: 7, color: '#555' }}>NIU</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, borderBottom: '0.5pt solid #999', paddingBottom: 1 }}>{data.niu ?? '—'}</Text>
          </View>
          <View style={S.col}>
            <Text style={{ fontSize: 7, color: '#555' }}>SCIEN</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, borderBottom: '0.5pt solid #999', paddingBottom: 1 }}>{data.scien ?? '—'}</Text>
          </View>
          <View style={S.col}>
            <Text style={{ fontSize: 7, color: '#555' }}>RCCM</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, borderBottom: '0.5pt solid #999', paddingBottom: 1 }}>{data.rccm ?? '—'}</Text>
          </View>
        </View>

        <View style={{ marginTop: 4 }}>
          <View style={S.row}>
            <Text style={S.label}>Dénomination sociale :</Text>
            <Text style={S.value}>{data.denomination_sociale ?? '—'}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Sigle :</Text>
            <Text style={[S.value, { flex: 0.5 }]}>{data.sigle ?? '—'}</Text>
            <Text style={{ width: 60, fontSize: 7, color: '#555' }}>Forme juridique :</Text>
            <Text style={[S.value, { flex: 0.5 }]}>{data.forme_juridique ?? '—'}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Adresse :</Text>
            <Text style={S.value}>{data.adresse ?? '—'}</Text>
          </View>
          <View style={S.rowThree}>
            <View style={S.col}>
              <Text style={{ fontSize: 7, color: '#555' }}>Téléphone</Text>
              <Text style={{ fontSize: 7.5, borderBottom: '0.5pt solid #999', paddingBottom: 1 }}>{data.telephone ?? '—'}</Text>
            </View>
            <View style={S.col}>
              <Text style={{ fontSize: 7, color: '#555' }}>Email</Text>
              <Text style={{ fontSize: 7.5, borderBottom: '0.5pt solid #999', paddingBottom: 1 }}>{data.email ?? '—'}</Text>
            </View>
            <View style={S.col}>
              <Text style={{ fontSize: 7, color: '#555' }}>Ville</Text>
              <Text style={{ fontSize: 7.5, borderBottom: '0.5pt solid #999', paddingBottom: 1 }}>{data.ville ?? '—'}</Text>
            </View>
            <View style={S.col}>
              <Text style={{ fontSize: 7, color: '#555' }}>Résidence fiscale</Text>
              <Text style={{ fontSize: 7.5, borderBottom: '0.5pt solid #999', paddingBottom: 1 }}>{data.residence_fiscale ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── SECTION B — CALCUL ───────────────────────────────────────── */}
        <Text style={S.sectionTitle}>B — RENSEIGNEMENTS ENTITÉ FISCALE ET CALCUL DE LA PATENTE</Text>

        <View style={S.table}>
          <View style={S.tableHeader}>
            <Text style={[S.tableHeaderCellNarrow, { width: 20 }]}>N°</Text>
            <Text style={S.tableHeaderCellWide}>DÉSIGNATION</Text>
            <Text style={[S.tableHeaderCell, { textAlign: 'right' }]}>MONTANT / VALEUR</Text>
          </View>
          {lignesB.map((l, i) => (
            <View key={l.n} style={l.big ? S.tableTotalRow : (i % 2 === 0 ? S.tableRow : S.tableRowAlt)}>
              <Text style={[S.tableCellNarrow, { width: 20, color: l.big ? '#FFF' : '#555' }]}>{l.n}</Text>
              <Text style={[
                S.tableCellWide,
                l.bold ? S.bold : {},
                l.big ? { color: '#FFF' } : {},
              ]}>{l.label}</Text>
              <Text style={[
                S.tableCellBoldRight,
                l.big ? { color: '#F59E0B', fontSize: 9 } : l.bold ? { color: '#1a1a1a' } : {},
              ]}>{l.valeur ?? '—'}</Text>
            </View>
          ))}
        </View>

        {/* ── SECTION C — RÉPARTITION ──────────────────────────────────── */}
        {depts.length > 0 && (
          <>
            <Text style={[S.sectionTitle, { marginTop: 8 }]}>C — RÉPARTITION PAR COLLECTIVITÉ LOCALE</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={S.tableHeaderCellWide}>DÉPARTEMENT</Text>
                <Text style={[S.tableHeaderCell, { textAlign: 'right' }]}>CA DÉPARTEMENT</Text>
                <Text style={[S.tableHeaderCell, { textAlign: 'right' }]}>% DU CA IMPOSABLE</Text>
                <Text style={[S.tableHeaderCell, { textAlign: 'right' }]}>DROITS DUS (FCFA)</Text>
              </View>
              {depts.filter(d => d.ca > 0).map((d, i) => (
                <View key={d.nom} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={S.tableCellWide}>{d.nom}</Text>
                  <Text style={S.tableCellRight}>{fmt(d.ca)}</Text>
                  <Text style={S.tableCellRight}>{pct(d.pourcentage)}</Text>
                  <Text style={S.tableCellBoldRight}>
                    {fmt(Math.round((data.patente_nette ?? 0) * (d.pourcentage / 100)))}
                  </Text>
                </View>
              ))}
              <View style={S.tableTotalRow}>
                <Text style={S.tableTotalLabel}>TOTAUX</Text>
                <Text style={S.tableTotalCell}>{fmt(depts.reduce((s, d) => s + d.ca, 0))}</Text>
                <Text style={S.tableTotalCell}>{pct(depts.reduce((s, d) => s + d.pourcentage, 0))}</Text>
                <Text style={S.tableTotalCell}>{fmt(data.patente_nette)}</Text>
              </View>
            </View>
          </>
        )}

        {/* ── SIGNATURE ─────────────────────────────────────────────────── */}
        <View style={S.signatureRow}>
          <View style={S.signatureBox}>
            <Text style={S.signatureLabel}>Fait à</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8 }}>{data.lieu_signature ?? data.ville ?? 'Brazzaville'}</Text>
          </View>
          <View style={S.signatureBox}>
            <Text style={S.signatureLabel}>Le</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8 }}>{fmtDate(data.date_signature)}</Text>
          </View>
          <View style={[S.signatureBox, { flex: 2 }]}>
            <Text style={S.signatureLabel}>Signature et cachet du déclarant</Text>
            <View style={{ height: 30 }} />
          </View>
        </View>

        {/* ── NOTES LÉGALES ─────────────────────────────────────────────── */}
        <View style={S.separator} />
        <View style={S.notes}>
          {NOTES.map((n, i) => (
            <Text key={i}>{n}</Text>
          ))}
        </View>

        {/* ── PIED DE PAGE ──────────────────────────────────────────────── */}
        <View style={{ position: 'absolute', bottom: 20, left: 28, right: 28 }}>
          <View style={{ borderTop: '0.5pt solid #CCC', paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 6.5, color: '#AAA' }}>Formulaire 721M — {data.annee} · oraforme.com</Text>
            <Text style={{ fontSize: 6.5, color: '#AAA' }}>DGID Congo — Direction Générale des Impôts et des Domaines</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
