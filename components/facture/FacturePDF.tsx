import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import { calculerTVACongo } from '@/lib/fiscalite-congo'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FacturePDFData {
  invoice_number: string
  client_name: string
  client_address?: string | null
  client_phone?: string | null
  client_email?: string | null
  date: string
  due_date?: string | null
  subtotal: number
  notes?: string | null
  statut: string
  lignes: { description: string; price: number; quantity: number; total: number }[]
  qr_data_url?: string | null   // QR code pour vérification authenticité
}

export interface EntrepriseConfigData {
  nom?: string | null
  logo_url?: string | null
  adresse?: string | null
  telephone?: string | null
  email?: string | null
  ville?: string | null
  pays?: string | null
  rccm?: string | null
  sciet?: string | null
  scien?: string | null
  capital?: string | null
  rib?: string | null
  message_defaut?: string | null
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const GOLD  = '#DC2626'
const BLACK = '#111111'
const GRAY  = '#6B7280'
const LGRAY = '#F9FAFB'
const WHITE = '#FFFFFF'
const MGRAY = '#374151'

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { padding: 44, backgroundColor: WHITE, fontFamily: 'Helvetica', fontSize: 9, color: BLACK },

  // Header
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  logoBox:      { width: 48, height: 48, backgroundColor: GOLD, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  logoLetter:   { color: BLACK, fontSize: 22, fontFamily: 'Helvetica-Bold' },
  logoImg:      { width: 48, height: 48, objectFit: 'contain', borderRadius: 6 },
  companyBlock: { marginLeft: 12 },
  companyName:  { fontSize: 15, fontFamily: 'Helvetica-Bold', color: BLACK },
  companyMeta:  { fontSize: 9, color: GRAY, marginTop: 3 },
  invoiceTitle: { fontSize: 38, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'right', letterSpacing: 3 },
  invoiceNum:   { fontSize: 11, color: GRAY, textAlign: 'right', marginTop: 4 },

  // Separator
  sep: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 20 },

  // Bill to + info box
  billRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  billLabel:    { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLACK, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  billName:     { fontSize: 13, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 4 },
  billInfo:     { fontSize: 9, color: GRAY, lineHeight: 1.6 },
  infoBox:      { borderLeftWidth: 3, borderLeftColor: GOLD, borderLeftStyle: 'solid', paddingLeft: 18, minWidth: 190 },
  infoLabel:    { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MGRAY, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  infoValue:    { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 12 },

  // Table header
  tableHead:    { flexDirection: 'row', backgroundColor: GOLD, padding: '10 0', marginBottom: 0 },
  thNo:         { width: '7%',  paddingLeft: 10,  paddingRight: 10,  color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase', textAlign: 'center' },
  thDesc:       { width: '43%', paddingLeft: 12,  paddingRight: 12,  color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase' },
  thPrice:      { width: '18%', paddingLeft: 10,  paddingRight: 10,  color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase', textAlign: 'right' },
  thQty:        { width: '10%', paddingLeft: 10,  paddingRight: 10,  color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase', textAlign: 'center' },
  thTotal:      { width: '22%', paddingLeft: 10,  paddingRight: 14,  color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase', textAlign: 'right' },

  // Table rows
  rowEven:      { flexDirection: 'row', backgroundColor: WHITE,  borderBottomWidth: 1, borderBottomColor: '#F3F4F6', borderBottomStyle: 'solid', padding: '9 0' },
  rowOdd:       { flexDirection: 'row', backgroundColor: LGRAY,  borderBottomWidth: 1, borderBottomColor: '#F3F4F6', borderBottomStyle: 'solid', padding: '9 0' },
  tdNo:         { width: '7%',  paddingLeft: 10,  paddingRight: 10,  fontSize: 9, color: '#9CA3AF', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  tdDesc:       { width: '43%', paddingLeft: 12,  paddingRight: 12,  fontSize: 10, color: BLACK },
  tdPrice:      { width: '18%', paddingLeft: 10,  paddingRight: 10,  fontSize: 9, color: MGRAY, textAlign: 'right' },
  tdQty:        { width: '10%', paddingLeft: 10,  paddingRight: 10,  fontSize: 9, color: MGRAY, textAlign: 'center' },
  tdTotal:      { width: '22%', paddingLeft: 10,  paddingRight: 14,  fontSize: 10, color: BLACK, fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  // Footer section
  footerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 28, marginBottom: 24 },
  leftCol:      { flex: 1, marginRight: 32 },
  sectionLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  sectionText:  { fontSize: 9, color: MGRAY, lineHeight: 1.6 },

  // Totals
  totalsCol:    { width: 240 },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', padding: '7 12', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', borderBottomStyle: 'solid' },
  totalLabel:   { fontSize: 9, color: MGRAY },
  totalValue:   { fontSize: 9, color: BLACK, fontFamily: 'Helvetica-Bold' },
  grandRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '10 12', backgroundColor: GOLD, marginTop: 2 },
  grandLabel:   { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 0.5 },
  grandValue:   { fontSize: 12, fontFamily: 'Helvetica-Bold', color: WHITE },

  // QR code
  qrBlock:      { alignItems: 'center' },
  qrImg:        { width: 60, height: 60 },
  qrLabel:      { fontSize: 6, color: '#9CA3AF', textAlign: 'center', marginTop: 3 },

  // Signature + thank you
  signRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#E5E7EB', borderTopStyle: 'solid', paddingTop: 18 },
  signLine:     { borderBottomWidth: 1.5, borderBottomColor: BLACK, borderBottomStyle: 'solid', width: 130, marginBottom: 6 },
  signName:     { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLACK },
  signTitle:    { fontSize: 9, color: GRAY, marginTop: 2 },
  thankYou:     { fontSize: 13, fontFamily: 'Helvetica-Bold', color: GOLD, textAlign: 'right', marginBottom: 8 },
  contactLine:  { fontSize: 9, color: GRAY, textAlign: 'right' },

  // Watermark
  watermark:    { position: 'absolute', top: '38%', left: '8%', transform: 'rotate(-35deg)', fontSize: 90, fontFamily: 'Helvetica-Bold', color: '#FF000008', opacity: 0.08 },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FacturePDF({ facture, config }: { facture: FacturePDFData; config: EntrepriseConfigData }) {
  const { tva, ca, ttc } = calculerTVACongo(facture.subtotal)
  const isDraft           = facture.statut === 'brouillon'
  const isAnnulee         = facture.statut === 'annulee'
  const companyLetter     = (config.nom ?? 'O').substring(0, 1).toUpperCase()
  const hasTerms          = config.rccm || config.sciet || config.scien || config.capital

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {isDraft   && <Text style={s.watermark}>BROUILLON</Text>}
        {isAnnulee && <Text style={s.watermark}>ANNULÉE</Text>}

        {/* ── HEADER ── */}
        <View style={s.headerRow}>
          {/* Left: logo + company */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            {config.logo_url ? (
              <Image src={config.logo_url} style={s.logoImg} />
            ) : (
              <View style={s.logoBox}>
                <Text style={s.logoLetter}>{companyLetter}</Text>
              </View>
            )}
            <View style={s.companyBlock}>
              <Text style={s.companyName}>{config.nom ?? 'oraforme'}</Text>
              {(config.ville || config.pays) && (
                <Text style={s.companyMeta}>{config.ville ?? ''}{config.pays ? `, ${config.pays}` : ''}</Text>
              )}
              <Text style={[s.companyMeta, { marginTop: 2 }]}>{fmtDate(facture.date)}</Text>
            </View>
          </View>

          {/* Right: INVOICE */}
          <View>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceNum}>#{facture.invoice_number}</Text>
          </View>
        </View>

        {/* Separator */}
        <View style={s.sep} />

        {/* ── INVOICE TO + INFO BOX ── */}
        <View style={s.billRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.billLabel}>Invoice To :</Text>
            <Text style={s.billName}>{facture.client_name}</Text>
            {facture.client_address && <Text style={s.billInfo}>{facture.client_address}</Text>}
            {facture.client_phone   && <Text style={s.billInfo}>{facture.client_phone}</Text>}
            {facture.client_email   && <Text style={s.billInfo}>{facture.client_email}</Text>}
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Invoice Number</Text>
            <Text style={s.infoValue}>{facture.invoice_number}</Text>
            <Text style={s.infoLabel}>Date</Text>
            <Text style={[s.infoValue, { marginBottom: facture.due_date ? 12 : 0 }]}>{fmtDate(facture.date)}</Text>
            {facture.due_date && (
              <>
                <Text style={s.infoLabel}>Due Date</Text>
                <Text style={[s.infoValue, { marginBottom: 0 }]}>{fmtDate(facture.due_date)}</Text>
              </>
            )}
          </View>
        </View>

        {/* ── ITEMS TABLE ── */}
        <View style={s.tableHead}>
          <Text style={s.thNo}>No</Text>
          <Text style={s.thDesc}>Item Description</Text>
          <Text style={s.thPrice}>Price</Text>
          <Text style={s.thQty}>Qty</Text>
          <Text style={s.thTotal}>Total</Text>
        </View>
        {facture.lignes.map((l, i) => (
          <View key={i} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
            <Text style={s.tdNo}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={s.tdDesc}>{l.description}</Text>
            <Text style={s.tdPrice}>{fmt(l.price)}</Text>
            <Text style={s.tdQty}>{l.quantity}</Text>
            <Text style={s.tdTotal}>{fmt(l.total)}</Text>
          </View>
        ))}

        {/* ── FOOTER: Payment + Terms | Totals ── */}
        <View style={s.footerRow}>
          {/* Left */}
          <View style={s.leftCol}>
            {config.rib && (
              <View style={{ marginBottom: 14 }}>
                <Text style={s.sectionLabel}>Payment Method</Text>
                <Text style={s.sectionText}>{config.rib}</Text>
              </View>
            )}
            {hasTerms && (
              <View style={{ marginBottom: facture.notes ? 14 : 0 }}>
                <Text style={s.sectionLabel}>Terms &amp; Conditions</Text>
                {config.rccm    && <Text style={s.sectionText}>RCCM : {config.rccm}</Text>}
                {config.sciet   && <Text style={s.sectionText}>SCIET : {config.sciet}</Text>}
                {config.scien   && <Text style={s.sectionText}>SCIEN : {config.scien}</Text>}
                {config.capital && <Text style={s.sectionText}>Capital : {config.capital} FCFA</Text>}
              </View>
            )}
            {facture.notes && (
              <View>
                <Text style={s.sectionLabel}>Notes</Text>
                <Text style={s.sectionText}>{facture.notes}</Text>
              </View>
            )}
          </View>

          {/* Right: totals */}
          <View style={s.totalsCol}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Sub Total</Text>
              <Text style={s.totalValue}>{fmt(facture.subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>TVA (18 %)</Text>
              <Text style={s.totalValue}>{fmt(tva)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>CA (5 % de la TVA)</Text>
              <Text style={s.totalValue}>{fmt(ca)}</Text>
            </View>
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Grand Total :</Text>
              <Text style={s.grandValue}>{fmt(ttc)}</Text>
            </View>
          </View>
        </View>

        {/* ── SIGNATURE + THANK YOU + QR ── */}
        <View style={s.signRow}>
          <View>
            <View style={s.signLine} />
            <Text style={s.signName}>{config.nom ?? 'Signature'}</Text>
            <Text style={s.signTitle}>Représentant autorisé</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={s.thankYou}>{config.message_defaut ?? 'Merci pour votre confiance !'}</Text>
            <Text style={s.contactLine}>
              {[config.telephone, config.email].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
          {facture.qr_data_url && (
            <View style={s.qrBlock}>
              <Image src={facture.qr_data_url} style={s.qrImg} />
              <Text style={s.qrLabel}>Scanner pour{'\n'}vérifier</Text>
            </View>
          )}
        </View>

      </Page>
    </Document>
  )
}
