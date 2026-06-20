import {
  Document, Page, View, Text, StyleSheet,
} from '@react-pdf/renderer'
import { calculerPaie, TAUX_CNSS_EMPLOYE } from '@/lib/paie/calcul-paie'

export interface PayslipData {
  // Entreprise
  nom_entreprise: string
  adresse?: string
  telephone?: string
  email?: string
  rccm?: string
  cnss_employeur?: string
  // Employé
  nom: string
  prenom: string
  poste: string
  numero_employe?: string
  date_embauche?: string
  cnss_employe?: string
  // Paie
  mois: string
  annee: number
  salaire_base: number
  // Éléments variables
  heures_sup?: number
  taux_heure_sup?: number
  primes?: { label: string; montant: number }[]
  retenues?: { label: string; montant: number }[]
  // Calculés auto
  cnss_part_employe?: number  // 5% du brut plafonné
  irpp?: number               // calculé progressif
  total_brut?: number
  total_deductions?: number
  net_a_payer?: number
  mode_paiement?: string
}

const GOLD  = '#DC2626'
const BLACK = '#111111'
const GRAY  = '#6B7280'
const LGRAY = '#F9FAFB'
const WHITE = '#FFFFFF'
const MGRAY = '#374151'

const s = StyleSheet.create({
  page: { padding: 40, backgroundColor: WHITE, fontFamily: 'Helvetica', fontSize: 9, color: BLACK },
  // Header
  headerBg: { backgroundColor: BLACK, padding: 16, borderRadius: 6, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 40, height: 40, backgroundColor: GOLD, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: BLACK, fontSize: 18, fontFamily: 'Helvetica-Bold' },
  companyName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: WHITE, marginLeft: 10 },
  companyMeta: { fontSize: 8, color: '#64748B', marginLeft: 10, marginTop: 2 },
  payslipTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: GOLD, textAlign: 'right' },
  payslipPeriod: { fontSize: 9, color: '#64748B', textAlign: 'right', marginTop: 3 },
  // Sections
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  section: { flex: 1, backgroundColor: LGRAY, borderRadius: 6, padding: 10 },
  sectionTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowLabel: { fontSize: 8, color: MGRAY },
  rowValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLACK },
  // Pay table
  tableHead: { flexDirection: 'row', backgroundColor: BLACK, padding: '8 10', marginBottom: 0 },
  thLabel: { flex: 1, color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase' },
  thBase: { width: 90, color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', textAlign: 'right' },
  thMontant: { width: 90, color: WHITE, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', textAlign: 'right' },
  tdRow: { flexDirection: 'row', padding: '7 10', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tdLabel: { flex: 1, fontSize: 9, color: BLACK },
  tdBase: { width: 90, fontSize: 8, color: GRAY, textAlign: 'right' },
  tdMontant: { width: 90, fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'right' },
  tdMontantNeg: { width: 90, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#DC2626', textAlign: 'right' },
  // Totals
  totalSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  totalsBox: { width: 250, backgroundColor: LGRAY, borderRadius: 6, padding: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalLabel: { fontSize: 8, color: MGRAY },
  totalValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLACK },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, backgroundColor: GOLD, borderRadius: 5, padding: '10 12' },
  netLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: WHITE },
  netValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: WHITE },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  signBlock: { width: 140 },
  signLabel: { fontSize: 7, color: GRAY, textTransform: 'uppercase', marginBottom: 6 },
  signLine: { borderBottomWidth: 1, borderBottomColor: BLACK, width: 120, marginBottom: 3 },
  signName: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLACK },
  notice: { fontSize: 7, color: GRAY, textAlign: 'center', lineHeight: 1.5, flex: 1, marginHorizontal: 16 },
})

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

// Délègue au moteur calcul-paie (formules légales Congo validées sur 3 cas test)

export function PayslipPDF({ data }: { data: PayslipData }) {
  const primes = data.primes ?? []
  const retenues = data.retenues ?? []
  const totalRetenues = retenues.reduce((s, r) => s + r.montant, 0)
  const totalPrimesCustom = primes.reduce((s, p) => s + p.montant, 0)

  // Calcul via le moteur légal Congo (CNSS 5.04%, IRPP barème progressif art.76)
  const calc = calculerPaie({
    salaire_base: data.salaire_base,
    heures_sup: data.heures_sup ?? 0,
    taux_horaire: data.taux_heure_sup ?? 0,
    autres_gains: totalPrimesCustom,
    autres_retenues: totalRetenues,
  })

  const brut = calc.salaire_brut
  const cnss = data.cnss_part_employe ?? calc.cnss_employe
  const irpp = data.irpp ?? calc.irpp
  const montantHeuresSup = calc.heures_sup_montant
  const totalDed = cnss + irpp + totalRetenues
  const net = data.net_a_payer ?? calc.salaire_net

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── HEADER ── */}
        <View style={s.headerBg}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={s.logo}>
              <Text style={s.logoText}>{data.nom_entreprise.charAt(0)}</Text>
            </View>
            <View>
              <Text style={s.companyName}>{data.nom_entreprise}</Text>
              {data.adresse && <Text style={s.companyMeta}>{data.adresse}</Text>}
              {data.rccm && <Text style={s.companyMeta}>RCCM : {data.rccm}</Text>}
            </View>
          </View>
          <View>
            <Text style={s.payslipTitle}>FICHE DE PAIE</Text>
            <Text style={s.payslipPeriod}>{data.mois} {data.annee}</Text>
          </View>
        </View>

        {/* ── EMPLOYÉ + EMPLOYEUR ── */}
        <View style={s.twoCol}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Informations Employé</Text>
            <View style={s.row}><Text style={s.rowLabel}>Nom complet</Text><Text style={s.rowValue}>{data.prenom} {data.nom}</Text></View>
            <View style={s.row}><Text style={s.rowLabel}>Poste</Text><Text style={s.rowValue}>{data.poste}</Text></View>
            {data.numero_employe && <View style={s.row}><Text style={s.rowLabel}>N° Employé</Text><Text style={s.rowValue}>{data.numero_employe}</Text></View>}
            {data.cnss_employe && <View style={s.row}><Text style={s.rowLabel}>N° CNSS</Text><Text style={s.rowValue}>{data.cnss_employe}</Text></View>}
            {data.date_embauche && <View style={s.row}><Text style={s.rowLabel}>Date embauche</Text><Text style={s.rowValue}>{data.date_embauche}</Text></View>}
          </View>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Informations Entreprise</Text>
            <View style={s.row}><Text style={s.rowLabel}>Entreprise</Text><Text style={s.rowValue}>{data.nom_entreprise}</Text></View>
            {data.telephone && <View style={s.row}><Text style={s.rowLabel}>Téléphone</Text><Text style={s.rowValue}>{data.telephone}</Text></View>}
            {data.email && <View style={s.row}><Text style={s.rowLabel}>Email</Text><Text style={s.rowValue}>{data.email}</Text></View>}
            {data.cnss_employeur && <View style={s.row}><Text style={s.rowLabel}>N° CNSS Emp.</Text><Text style={s.rowValue}>{data.cnss_employeur}</Text></View>}
            <View style={s.row}><Text style={s.rowLabel}>Mode paiement</Text><Text style={s.rowValue}>{data.mode_paiement ?? 'Virement'}</Text></View>
          </View>
        </View>

        {/* ── ÉLÉMENTS DE SALAIRE ── */}
        <View style={s.tableHead}>
          <Text style={s.thLabel}>Désignation</Text>
          <Text style={s.thBase}>Base / Taux</Text>
          <Text style={s.thMontant}>{'Montant'}</Text>
        </View>

        {/* Salaire de base */}
        <View style={s.tdRow}>
          <Text style={s.tdLabel}>Salaire de base</Text>
          <Text style={s.tdBase}>1 mois</Text>
          <Text style={s.tdMontant}>{fmt(data.salaire_base)}</Text>
        </View>

        {/* Heures sup */}
        {(data.heures_sup ?? 0) > 0 && (
          <View style={s.tdRow}>
            <Text style={s.tdLabel}>Heures supplémentaires</Text>
            <Text style={s.tdBase}>{data.heures_sup}h × {fmt(data.taux_heure_sup ?? 0)}</Text>
            <Text style={s.tdMontant}>{fmt(montantHeuresSup)}</Text>
          </View>
        )}

        {/* Primes */}
        {primes.map((p, i) => (
          <View key={i} style={s.tdRow}>
            <Text style={s.tdLabel}>{p.label}</Text>
            <Text style={s.tdBase}>Prime</Text>
            <Text style={s.tdMontant}>{fmt(p.montant)}</Text>
          </View>
        ))}

        {/* Separator */}
        <View style={{ height: 1, backgroundColor: BLACK, marginVertical: 2 }} />

        {/* CNSS */}
        <View style={[s.tdRow, { backgroundColor: LGRAY }]}>
          <Text style={s.tdLabel}>Cotisation CNSS (part salarié)</Text>
          <Text style={s.tdBase}>{(TAUX_CNSS_EMPLOYE * 100).toFixed(2)}% brut plafonné</Text>
          <Text style={s.tdMontantNeg}>- {fmt(cnss)}</Text>
        </View>

        {/* IRPP */}
        <View style={[s.tdRow, { backgroundColor: LGRAY }]}>
          <Text style={s.tdLabel}>IRPP (barème progressif art.76 CGI)</Text>
          <Text style={s.tdBase}>Revenu imposable</Text>
          <Text style={s.tdMontantNeg}>- {fmt(irpp)}</Text>
        </View>

        {/* Retenues diverses */}
        {retenues.map((r, i) => (
          <View key={i} style={[s.tdRow, { backgroundColor: LGRAY }]}>
            <Text style={s.tdLabel}>{r.label}</Text>
            <Text style={s.tdBase}>Retenue</Text>
            <Text style={s.tdMontantNeg}>- {fmt(r.montant)}</Text>
          </View>
        ))}

        {/* ── TOTAUX ── */}
        <View style={s.totalSection}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Salaire brut</Text>
              <Text style={s.totalValue}>{fmt(brut)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total cotisations</Text>
              <Text style={[s.totalValue, { color: '#DC2626' }]}>- {fmt(totalDed)}</Text>
            </View>
            <View style={s.netRow}>
              <Text style={s.netLabel}>NET À PAYER</Text>
              <Text style={s.netValue}>{fmt(net)}</Text>
            </View>
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <View style={s.signBlock}>
            <Text style={s.signLabel}>Signature Employé</Text>
            <View style={s.signLine} />
            <Text style={s.signName}>{data.prenom} {data.nom}</Text>
          </View>
          <Text style={s.notice}>
            Ce bulletin de salaire est conforme aux dispositions du Code du Travail Congolais et aux règles CNSS/IRPP en vigueur.
            Conservez ce document.
          </Text>
          <View style={[s.signBlock, { alignItems: 'flex-end' }]}>
            <Text style={s.signLabel}>La Direction</Text>
            <View style={[s.signLine, { alignSelf: 'flex-end' }]} />
            <Text style={s.signName}>{data.nom_entreprise}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
