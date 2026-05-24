import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AttestationType = 'inscription' | 'frequentation' | 'reussite' | 'stage'

export interface AttestationPDFData {
  // Établissement
  nom_ecole:         string
  logo_url?:         string | null
  adresse_ecole?:    string
  telephone_ecole?:  string
  email_ecole?:      string
  // Étudiant
  nom:               string
  prenom:            string
  date_naissance?:   string
  nationalite?:      string
  numero_etudiant:   string
  classe:            string
  niveau:            string
  // Attestation
  type:              AttestationType
  annee_academique:  string
  date_delivrance:   string
  numero_attestation: string
  objet_stage?:      string    // Pour attestation de stage
  duree_stage?:      string    // Pour attestation de stage
  entreprise_stage?: string    // Pour attestation de stage
  // Validation
  directeur?:        string
  // QR
  qr_data_url?:      string
}

// ── Design ────────────────────────────────────────────────────────────────────

const GOLD  = '#DC2626'
const BLACK = '#111111'
const GRAY  = '#6B7280'
const WHITE = '#FFFFFF'
const LGRAY = '#F9FAFB'
const MGRAY = '#374151'

const s = StyleSheet.create({
  page: { padding: 52, backgroundColor: WHITE, fontFamily: 'Helvetica', fontSize: 10, color: BLACK },

  // Bordure de fond
  borderTop:    { height: 6, backgroundColor: GOLD, marginBottom: 0 },
  borderBottom: { height: 4, backgroundColor: GOLD, marginTop: 24 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', borderBottomStyle: 'solid' },
  logoBox: { width: 56, height: 56, backgroundColor: GOLD, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: BLACK, fontSize: 24, fontFamily: 'Helvetica-Bold' },
  logoImg: { width: 56, height: 56, objectFit: 'contain', borderRadius: 6 },
  schoolBlock: { flex: 1, paddingLeft: 16 },
  schoolName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: BLACK },
  schoolMeta: { fontSize: 8, color: GRAY, marginTop: 3, lineHeight: 1.6 },
  refBlock: { alignItems: 'flex-end' },
  refLabel: { fontSize: 7, color: GRAY, textTransform: 'uppercase', letterSpacing: 1 },
  refValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GOLD },

  // Titre
  titleSection: { alignItems: 'center', marginVertical: 24 },
  titleMain: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'center', letterSpacing: 3, textTransform: 'uppercase' },
  titleType: { fontSize: 14, color: GOLD, textAlign: 'center', marginTop: 4, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  titleSep: { height: 2, width: 80, backgroundColor: GOLD, alignSelf: 'center', marginTop: 12 },

  // Corps
  bodyWrap: { backgroundColor: LGRAY, borderRadius: 6, padding: 20, marginVertical: 20 },
  bodyLine: { fontSize: 11, color: MGRAY, lineHeight: 2.0, textAlign: 'justify' },
  nameInline: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: BLACK },
  highlight: { color: GOLD, fontFamily: 'Helvetica-Bold' },

  // Tableau infos étudiant
  infoTable: { marginTop: 16, marginBottom: 16 },
  infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', borderBottomStyle: 'solid', paddingVertical: 7 },
  infoLabel: { width: '40%', fontSize: 9, color: GRAY, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { width: '60%', fontSize: 10, color: BLACK, fontFamily: 'Helvetica-Bold' },

  // Note légale
  legal: { fontSize: 8, color: GRAY, textAlign: 'center', lineHeight: 1.5, marginTop: 16, fontStyle: 'italic' },

  // Signature + date + QR
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB', borderTopStyle: 'solid' },
  dateBlock: { alignItems: 'flex-start' },
  dateLabel: { fontSize: 8, color: GRAY },
  dateValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BLACK, marginTop: 2 },
  signBlock: { alignItems: 'center' },
  signLine: { borderBottomWidth: 1.5, borderBottomColor: BLACK, borderBottomStyle: 'solid', width: 140, marginBottom: 6 },
  signName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'center' },
  signTitle: { fontSize: 8, color: GRAY, textAlign: 'center', marginTop: 2 },
  qrBlock: { alignItems: 'center' },
  qrImg: { width: 60, height: 60 },
  qrLabel: { fontSize: 6, color: GRAY, marginTop: 3, textAlign: 'center' },

  watermark: { position: 'absolute', top: '40%', left: '8%', transform: 'rotate(-35deg)', fontSize: 80, fontFamily: 'Helvetica-Bold', color: '#DC262606' },
})

const TYPE_LABELS: Record<AttestationType, string> = {
  inscription:   "D'INSCRIPTION",
  frequentation: "DE FRÉQUENTATION",
  reussite:      "DE RÉUSSITE",
  stage:         "DE STAGE",
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return d }
}

function buildBodyText(data: AttestationPDFData) {
  const fullName = `${data.prenom} ${data.nom}`.toUpperCase()
  switch (data.type) {
    case 'inscription':
      return `Le Directeur de ${data.nom_ecole} soussigné atteste que l'étudiant(e) ${fullName}, numéro ${data.numero_etudiant}, est régulièrement inscrit(e) en ${data.classe} (${data.niveau}) pour l'année académique ${data.annee_academique}. La présente attestation lui est délivrée pour servir et valoir ce que de droit.`
    case 'frequentation':
      return `Le Directeur de ${data.nom_ecole} soussigné atteste que l'étudiant(e) ${fullName}, numéro ${data.numero_etudiant}, a régulièrement fréquenté ${data.nom_ecole} en ${data.classe} (${data.niveau}) durant l'année académique ${data.annee_academique}. La présente attestation lui est délivrée pour servir et valoir ce que de droit.`
    case 'reussite':
      return `Le Directeur de ${data.nom_ecole} soussigné atteste que l'étudiant(e) ${fullName}, numéro ${data.numero_etudiant}, a satisfait aux épreuves de l'année académique ${data.annee_academique} et a réussi en ${data.classe} (${data.niveau}). La présente attestation lui est délivrée pour servir et valoir ce que de droit.`
    case 'stage':
      return `Le Directeur de ${data.nom_ecole} soussigné atteste que l'étudiant(e) ${fullName}, numéro ${data.numero_etudiant}, inscrit(e) en ${data.classe} (${data.niveau}), a effectué un stage de ${data.duree_stage ?? '...'} auprès de ${data.entreprise_stage ?? '...'} portant sur ${data.objet_stage ?? 'la spécialité'} dans le cadre de sa formation pour l'année académique ${data.annee_academique}. La présente attestation lui est délivrée pour servir et valoir ce que de droit.`
  }
}

export function AttestationPDF({ data }: { data: AttestationPDFData }) {
  const logoLetter = data.nom_ecole.substring(0, 1).toUpperCase()
  const bodyText = buildBodyText(data)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.watermark}>ATTESTATION</Text>

        {/* ── Bande dorée top ─────────────────────────────────────── */}
        <View style={s.borderTop} />

        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={s.header}>
          {data.logo_url ? (
            <Image src={data.logo_url} style={s.logoImg} />
          ) : (
            <View style={s.logoBox}><Text style={s.logoLetter}>{logoLetter}</Text></View>
          )}
          <View style={s.schoolBlock}>
            <Text style={s.schoolName}>{data.nom_ecole}</Text>
            {data.adresse_ecole && <Text style={s.schoolMeta}>{data.adresse_ecole}</Text>}
            {data.telephone_ecole && <Text style={s.schoolMeta}>Tél : {data.telephone_ecole}</Text>}
            {data.email_ecole && <Text style={s.schoolMeta}>{data.email_ecole}</Text>}
          </View>
          <View style={s.refBlock}>
            <Text style={s.refLabel}>Réf. attestation</Text>
            <Text style={s.refValue}>{data.numero_attestation}</Text>
          </View>
        </View>

        {/* ── Titre ───────────────────────────────────────────────── */}
        <View style={s.titleSection}>
          <Text style={s.titleMain}>ATTESTATION</Text>
          <Text style={s.titleType}>{TYPE_LABELS[data.type]}</Text>
          <View style={s.titleSep} />
        </View>

        {/* ── Tableau infos étudiant ───────────────────────────────── */}
        <View style={s.infoTable}>
          {[
            ['Nom & Prénom',   `${data.prenom} ${data.nom}`],
            ['N° Étudiant',    data.numero_etudiant],
            ['Classe / Niveau', `${data.classe} — ${data.niveau}`],
            ['Année académique', data.annee_academique],
            ...(data.nationalite ? [['Nationalité', data.nationalite] as [string, string]] : []),
          ].map(([label, value]) => (
            <View key={label} style={s.infoRow}>
              <Text style={s.infoLabel}>{label}</Text>
              <Text style={s.infoValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── Corps de l'attestation ───────────────────────────────── */}
        <View style={s.bodyWrap}>
          <Text style={s.bodyLine}>{bodyText}</Text>
        </View>

        {/* ── Note légale ─────────────────────────────────────────── */}
        <Text style={s.legal}>
          Cette attestation n&apos;est valable que pour l&apos;année académique {data.annee_academique}.
          Toute falsification est punissable par la loi.
        </Text>

        {/* ── Signature + QR ──────────────────────────────────────── */}
        <View style={s.bottomRow}>
          <View style={s.dateBlock}>
            <Text style={s.dateLabel}>Délivrée le</Text>
            <Text style={s.dateValue}>{fmtDate(data.date_delivrance)}</Text>
          </View>
          <View style={s.signBlock}>
            <View style={s.signLine} />
            <Text style={s.signName}>{data.directeur ?? 'Le Directeur'}</Text>
            <Text style={s.signTitle}>Cachet et signature</Text>
          </View>
          {data.qr_data_url ? (
            <View style={s.qrBlock}>
              <Image src={data.qr_data_url} style={s.qrImg} />
              <Text style={s.qrLabel}>Scanner pour vérifier</Text>
            </View>
          ) : <View style={{ width: 60 }} />}
        </View>

        {/* Bande dorée bottom */}
        <View style={s.borderBottom} />
      </Page>
    </Document>
  )
}
