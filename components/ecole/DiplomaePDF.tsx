import {
  Document, Page, View, Text, Image, StyleSheet, Canvas,
} from '@react-pdf/renderer'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiplomaePDFData {
  // Établissement
  nom_ecole:       string
  logo_url?:       string | null
  adresse_ecole?:  string
  telephone_ecole?: string
  email_ecole?:    string
  // Récipiendaire
  nom:             string
  prenom:          string
  date_naissance?: string
  lieu_naissance?: string
  nationalite?:    string
  // Diplôme
  intitule_diplome: string       // ex: "Licence en Informatique"
  mention:          string       // ex: "Très Bien"
  moyenne?:         number
  annee_academique: string
  date_delivrance:  string
  numero_diplome:   string
  // Signatures
  directeur?:      string
  jury_president?: string
  // Vérification
  qr_data_url?:    string        // data URL du QR code
  verification_url?: string
}

// ── Design ────────────────────────────────────────────────────────────────────

const GOLD    = '#C8A400'
const GOLD2   = '#F51E33'
const BLACK   = '#0A0A0A'
const GRAY    = '#6B7280'
const WHITE   = '#FFFFFF'
const LGRAY   = '#F9FAFB'
const BORDER  = '#D4AF37'

const s = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: WHITE,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: BLACK,
  },

  // Bordure dorée extérieure
  outerBorder: {
    margin: 16,
    borderWidth: 3,
    borderColor: GOLD,
    borderStyle: 'solid',
    flex: 1,
    flexDirection: 'column',
  },

  innerBorder: {
    margin: 6,
    borderWidth: 1,
    borderColor: GOLD,
    borderStyle: 'solid',
    flex: 1,
    padding: 28,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    borderBottomStyle: 'solid',
  },
  logoBox: {
    width: 64, height: 64,
    backgroundColor: GOLD,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  logoLetter: { color: BLACK, fontSize: 28, fontFamily: 'Helvetica-Bold' },
  logoImg:    { width: 64, height: 64, objectFit: 'contain', borderRadius: 8 },
  schoolBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  schoolName:  { fontSize: 14, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'center', letterSpacing: 1 },
  schoolMeta:  { fontSize: 8, color: GRAY, textAlign: 'center', marginTop: 3 },
  numBlock:    { alignItems: 'flex-end' },
  numLabel:    { fontSize: 7, color: GRAY, textTransform: 'uppercase', letterSpacing: 1 },
  numValue:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GOLD },

  // Titre central
  centreSection: { alignItems: 'center', marginVertical: 20 },
  diplomaTitle:  { fontSize: 36, fontFamily: 'Helvetica-Bold', color: GOLD, textAlign: 'center', letterSpacing: 4 },
  diplomaSub:    { fontSize: 11, color: GRAY, textAlign: 'center', marginTop: 4, letterSpacing: 2 },
  separator:     { height: 2, backgroundColor: GOLD, width: 120, alignSelf: 'center', marginVertical: 14 },

  // Corps
  bodyText:    { fontSize: 11, color: BLACK, textAlign: 'center', lineHeight: 1.8, marginBottom: 6 },
  nameText:    { fontSize: 22, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'center', marginVertical: 10, letterSpacing: 2 },
  diplomeName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: GOLD, textAlign: 'center', marginVertical: 6 },
  mentionBox:  {
    alignSelf: 'center',
    borderWidth: 2, borderColor: GOLD, borderStyle: 'solid',
    paddingHorizontal: 24, paddingVertical: 8,
    marginTop: 12, marginBottom: 20,
    borderRadius: 4,
  },
  mentionText: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: GOLD, textAlign: 'center', letterSpacing: 2 },

  // Infos étudiant
  infoGrid:  { flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 16 },
  infoItem:  { alignItems: 'center' },
  infoLabel: { fontSize: 7, color: GRAY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  infoValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLACK },

  // Signatures
  signRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB', borderTopStyle: 'solid' },
  signBlock: { alignItems: 'center', minWidth: 140 },
  signLine:  { borderBottomWidth: 1.5, borderBottomColor: BLACK, borderBottomStyle: 'solid', width: 140, marginBottom: 6 },
  signName:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'center' },
  signTitle: { fontSize: 8, color: GRAY, textAlign: 'center', marginTop: 2 },

  // Bas de page
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: GOLD, borderTopStyle: 'solid' },
  footerText: { fontSize: 7, color: GRAY },
  qrBlock: { alignItems: 'center' },
  qrImg:   { width: 56, height: 56 },
  qrLabel: { fontSize: 6, color: GRAY, marginTop: 3, textAlign: 'center' },
  watermark: { position: 'absolute', top: '42%', left: '5%', transform: 'rotate(-35deg)', fontSize: 80, fontFamily: 'Helvetica-Bold', color: '#F51E3308', opacity: 0.06 },
})

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return d }
}

export function DiplomaePDF({ data }: { data: DiplomaePDFData }) {
  const logoLetter = data.nom_ecole.substring(0, 1).toUpperCase()

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.watermark}>OFFICIEL</Text>

        <View style={s.outerBorder}>
          <View style={s.innerBorder}>

            {/* ── Header ─────────────────────────────────────────────── */}
            <View style={s.header}>
              {data.logo_url ? (
                <Image src={data.logo_url} style={s.logoImg} />
              ) : (
                <View style={s.logoBox}><Text style={s.logoLetter}>{logoLetter}</Text></View>
              )}

              <View style={s.schoolBlock}>
                <Text style={s.schoolName}>{data.nom_ecole.toUpperCase()}</Text>
                {data.adresse_ecole && <Text style={s.schoolMeta}>{data.adresse_ecole}</Text>}
                {data.email_ecole && <Text style={s.schoolMeta}>{data.email_ecole}</Text>}
              </View>

              <View style={s.numBlock}>
                <Text style={s.numLabel}>N° Diplôme</Text>
                <Text style={s.numValue}>{data.numero_diplome}</Text>
              </View>
            </View>

            {/* ── Titre central ──────────────────────────────────────── */}
            <View style={s.centreSection}>
              <Text style={s.diplomaTitle}>DIPLÔME</Text>
              <Text style={s.diplomaSub}>ANNÉE ACADÉMIQUE {data.annee_academique}</Text>
              <View style={s.separator} />
            </View>

            {/* ── Corps ─────────────────────────────────────────────── */}
            <Text style={s.bodyText}>Le directeur de {data.nom_ecole} certifie que</Text>
            <Text style={s.nameText}>{data.prenom.toUpperCase()} {data.nom.toUpperCase()}</Text>

            {(data.date_naissance || data.lieu_naissance) && (
              <Text style={s.bodyText}>
                {data.date_naissance ? `né(e) le ${fmtDate(data.date_naissance)}` : ''}
                {data.lieu_naissance ? ` à ${data.lieu_naissance}` : ''}
              </Text>
            )}

            <Text style={[s.bodyText, { marginTop: 10 }]}>
              a satisfait aux épreuves et obtenu le diplôme de
            </Text>
            <Text style={s.diplomeName}>{data.intitule_diplome.toUpperCase()}</Text>

            {data.moyenne && (
              <Text style={s.bodyText}>avec une moyenne de {data.moyenne.toFixed(2)} / 20</Text>
            )}

            <View style={s.mentionBox}>
              <Text style={s.mentionText}>MENTION : {data.mention.toUpperCase()}</Text>
            </View>

            {/* Info grid */}
            <View style={s.infoGrid}>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>Délivré le</Text>
                <Text style={s.infoValue}>{fmtDate(data.date_delivrance)}</Text>
              </View>
              {data.nationalite && (
                <View style={s.infoItem}>
                  <Text style={s.infoLabel}>Nationalité</Text>
                  <Text style={s.infoValue}>{data.nationalite}</Text>
                </View>
              )}
            </View>

            {/* ── Signatures ─────────────────────────────────────────── */}
            <View style={s.signRow}>
              <View style={s.signBlock}>
                <View style={s.signLine} />
                <Text style={s.signName}>{data.jury_president ?? 'Président du Jury'}</Text>
                <Text style={s.signTitle}>Président du Jury</Text>
              </View>
              <View style={s.signBlock}>
                <View style={s.signLine} />
                <Text style={s.signName}>{data.directeur ?? 'Le Directeur'}</Text>
                <Text style={s.signTitle}>Directeur de l&apos;Établissement</Text>
              </View>
            </View>

            {/* ── Footer + QR ──────────────────────────────────────────── */}
            <View style={s.footer}>
              <Text style={s.footerText}>
                Ce diplôme est un document officiel. Toute falsification est punissable par la loi.
              </Text>
              {data.qr_data_url ? (
                <View style={s.qrBlock}>
                  <Image src={data.qr_data_url} style={s.qrImg} />
                  <Text style={s.qrLabel}>Vérifier l&apos;authenticité</Text>
                </View>
              ) : null}
            </View>

          </View>
        </View>
      </Page>
    </Document>
  )
}
