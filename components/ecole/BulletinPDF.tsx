import {
  Document, Page, View, Text, StyleSheet,
} from '@react-pdf/renderer'

export interface BulletinNote {
  matiere: string
  note: number
  note_max: number
  coefficient: number
  commentaire?: string
}

export interface BulletinPDFData {
  // Établissement
  nom_ecole: string
  logo_url?: string | null
  adresse_ecole?: string
  telephone_ecole?: string
  annee_scolaire: string
  periode: string
  // Étudiant
  nom_etudiant: string
  prenom_etudiant: string
  numero_id: string
  classe: string
  niveau: string
  // Notes
  notes: BulletinNote[]
  // Résultats
  moyenne_generale: number
  rang?: number
  effectif_classe?: number
  appreciation?: string
  mention?: string
  // Validation
  directeur?: string
  professeur_principal?: string
}

// Colors
const GOLD   = '#F51E33'
const BLACK  = '#111111'
const GRAY   = '#6B7280'
const LGRAY  = '#F9FAFB'
const WHITE  = '#FFFFFF'
const MGRAY  = '#374151'
const GREEN  = '#2EA043'
const RED    = '#F51E33'

const s = StyleSheet.create({
  page: { padding: 36, backgroundColor: WHITE, fontFamily: 'Helvetica', fontSize: 9, color: BLACK },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logo: { width: 44, height: 44, backgroundColor: GOLD, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: BLACK, fontSize: 20, fontFamily: 'Helvetica-Bold' },
  schoolName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'center' },
  schoolMeta: { fontSize: 8, color: GRAY, textAlign: 'center', marginTop: 2 },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: GOLD, textAlign: 'right' },
  titleSub: { fontSize: 9, color: GRAY, textAlign: 'right', marginTop: 2 },

  // Separator
  sep: { height: 2, backgroundColor: GOLD, marginVertical: 10 },
  sepThin: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },

  // Student info
  infoRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  infoBox: { flex: 1, backgroundColor: LGRAY, borderRadius: 6, padding: 10 },
  infoLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BLACK },
  infoBadge: { backgroundColor: GOLD, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
  infoBadgeText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLACK },

  // Notes table
  tableHead: { flexDirection: 'row', backgroundColor: BLACK, paddingVertical: 7, paddingHorizontal: 4, marginBottom: 0 },
  thMatiere: { width: '35%', color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase' },
  thNote: { width: '15%', color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', textAlign: 'center' },
  thMax: { width: '12%', color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', textAlign: 'center' },
  thCoef: { width: '10%', color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', textAlign: 'center' },
  thPct: { width: '13%', color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', textAlign: 'center' },
  thComm: { width: '15%', color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase' },

  rowEven: { flexDirection: 'row', backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 4 },
  rowOdd:  { flexDirection: 'row', backgroundColor: LGRAY, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 4 },

  tdMatiere: { width: '35%', fontSize: 9, color: BLACK, fontFamily: 'Helvetica-Bold' },
  tdNote: { width: '15%', fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  tdMax:  { width: '12%', fontSize: 8, color: GRAY, textAlign: 'center' },
  tdCoef: { width: '10%', fontSize: 8, color: MGRAY, textAlign: 'center' },
  tdPct:  { width: '13%', fontSize: 8, textAlign: 'center' },
  tdComm: { width: '15%', fontSize: 7, color: GRAY },

  // Results row
  resultsRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  resultBox: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  resultLabel: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  resultValue: { fontSize: 22, fontFamily: 'Helvetica-Bold' },
  resultSub: { fontSize: 7, marginTop: 2 },

  // Appreciation
  appreciationBox: { marginTop: 10, backgroundColor: LGRAY, borderRadius: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: GOLD },
  appreciationLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', marginBottom: 4 },
  appreciationText: { fontSize: 9, color: MGRAY, lineHeight: 1.5 },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12 },
  signBlock: { width: 140 },
  signLabel: { fontSize: 7, color: GRAY, textTransform: 'uppercase', marginBottom: 4 },
  signLine: { borderBottomWidth: 1, borderBottomColor: BLACK, marginBottom: 3, width: 120 },
  signName: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLACK },
  signTitle: { fontSize: 7, color: GRAY },
  stamp: { fontSize: 7, color: GRAY, textAlign: 'center' },
})

function pct(note: number, max: number): number {
  return Math.round((note / max) * 100)
}
function noteColor(note: number, max: number): string {
  const p = pct(note, max)
  if (p >= 75) return GREEN
  if (p >= 50) return GOLD
  return RED
}
function mention(avg: number, max: number): string {
  const p = (avg / max) * 100
  if (p >= 90) return 'Excellent'
  if (p >= 75) return 'Très Bien'
  if (p >= 65) return 'Bien'
  if (p >= 55) return 'Assez Bien'
  if (p >= 50) return 'Passable'
  return 'Insuffisant'
}

export function BulletinPDF({ data }: { data: BulletinPDFData }) {
  const moy = data.moyenne_generale
  const max = 20
  const men = data.mention ?? mention(moy, max)
  const moyColor = noteColor(moy, max)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={s.logo}>
              <Text style={s.logoText}>{data.nom_ecole.charAt(0)}</Text>
            </View>
            <View>
              <Text style={s.schoolName}>{data.nom_ecole}</Text>
              {data.adresse_ecole && <Text style={s.schoolMeta}>{data.adresse_ecole}</Text>}
              {data.telephone_ecole && <Text style={s.schoolMeta}>{data.telephone_ecole}</Text>}
            </View>
          </View>
          <View>
            <Text style={s.title}>BULLETIN</Text>
            <Text style={s.titleSub}>Année : {data.annee_scolaire}</Text>
            <Text style={[s.titleSub, { color: GOLD }]}>{data.periode}</Text>
          </View>
        </View>

        <View style={s.sep} />

        {/* ── STUDENT INFO ── */}
        <View style={s.infoRow}>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Étudiant</Text>
            <Text style={s.infoValue}>{data.prenom_etudiant} {data.nom_etudiant}</Text>
            <Text style={[s.infoLabel, { marginTop: 6 }]}>N° Matricule</Text>
            <Text style={{ fontSize: 9, color: MGRAY }}>{data.numero_id}</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Classe</Text>
            <Text style={s.infoValue}>{data.classe}</Text>
            <Text style={[s.infoLabel, { marginTop: 6 }]}>Niveau</Text>
            <Text style={{ fontSize: 9, color: MGRAY }}>{data.niveau}</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Période</Text>
            <Text style={s.infoValue}>{data.periode}</Text>
            <Text style={[s.infoLabel, { marginTop: 6 }]}>Année scolaire</Text>
            <Text style={{ fontSize: 9, color: MGRAY }}>{data.annee_scolaire}</Text>
          </View>
        </View>

        {/* ── NOTES TABLE ── */}
        <View style={s.tableHead}>
          <Text style={s.thMatiere}>Matière</Text>
          <Text style={s.thNote}>Note</Text>
          <Text style={s.thMax}>/ Max</Text>
          <Text style={s.thCoef}>Coef.</Text>
          <Text style={s.thPct}>%</Text>
          <Text style={s.thComm}>Commentaire</Text>
        </View>
        {data.notes.map((n, i) => (
          <View key={i} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
            <Text style={s.tdMatiere}>{n.matiere}</Text>
            <Text style={[s.tdNote, { color: noteColor(n.note, n.note_max) }]}>{n.note.toFixed(2)}</Text>
            <Text style={s.tdMax}>{n.note_max}</Text>
            <Text style={s.tdCoef}>{n.coefficient}</Text>
            <Text style={[s.tdPct, { color: noteColor(n.note, n.note_max) }]}>{pct(n.note, n.note_max)}%</Text>
            <Text style={s.tdComm}>{n.commentaire ?? ''}</Text>
          </View>
        ))}

        {/* ── RESULTS ── */}
        <View style={s.resultsRow}>
          <View style={[s.resultBox, { backgroundColor: moyColor + '15', borderWidth: 1.5, borderColor: moyColor }]}>
            <Text style={[s.resultLabel, { color: moyColor }]}>Moyenne générale</Text>
            <Text style={[s.resultValue, { color: moyColor }]}>{moy.toFixed(2)}</Text>
            <Text style={[s.resultSub, { color: moyColor }]}>/ {max}</Text>
          </View>
          {data.rang && (
            <View style={[s.resultBox, { backgroundColor: '#F51E3315', borderWidth: 1.5, borderColor: '#F51E33' }]}>
              <Text style={[s.resultLabel, { color: '#F51E33' }]}>Rang de classe</Text>
              <Text style={[s.resultValue, { color: '#F51E33' }]}>{data.rang}</Text>
              {data.effectif_classe && <Text style={[s.resultSub, { color: '#F51E33' }]}>/ {data.effectif_classe} élèves</Text>}
            </View>
          )}
          <View style={[s.resultBox, { backgroundColor: GOLD + '15', borderWidth: 1.5, borderColor: GOLD }]}>
            <Text style={[s.resultLabel, { color: GOLD }]}>Mention</Text>
            <Text style={[s.resultValue, { color: GOLD, fontSize: 13, textAlign: 'center' }]}>{men}</Text>
          </View>
        </View>

        {/* ── APPRECIATION ── */}
        {data.appreciation && (
          <View style={s.appreciationBox}>
            <Text style={s.appreciationLabel}>Appréciation du conseil de classe</Text>
            <Text style={s.appreciationText}>{data.appreciation}</Text>
          </View>
        )}

        {/* ── FOOTER SIGNATURES ── */}
        <View style={s.footer}>
          {data.professeur_principal && (
            <View style={s.signBlock}>
              <Text style={s.signLabel}>Professeur principal</Text>
              <View style={s.signLine} />
              <Text style={s.signName}>{data.professeur_principal}</Text>
              <Text style={s.signTitle}>Signature & cachet</Text>
            </View>
          )}
          <View style={{ alignItems: 'center' }}>
            <Text style={s.stamp}>Ce bulletin est certifié conforme</Text>
            <Text style={[s.stamp, { color: GOLD, fontFamily: 'Helvetica-Bold', marginTop: 2 }]}>{data.nom_ecole}</Text>
          </View>
          {data.directeur && (
            <View style={[s.signBlock, { alignItems: 'flex-end' }]}>
              <Text style={s.signLabel}>La Direction</Text>
              <View style={[s.signLine, { alignSelf: 'flex-end' }]} />
              <Text style={s.signName}>{data.directeur}</Text>
              <Text style={s.signTitle}>Directeur(trice)</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}
