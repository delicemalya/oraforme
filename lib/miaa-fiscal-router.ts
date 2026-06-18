import { MIAA_FISCAL_CONTEXT as CONGO }             from './fiscalite-congo'
import { MIAA_FISCAL_CONTEXT as CAMEROUN }          from './fiscalite-cameroun'
import { MIAA_FISCAL_CONTEXT as GABON }             from './fiscalite-gabon'
import { MIAA_FISCAL_CONTEXT as TCHAD }             from './fiscalite-tchad'
import { MIAA_FISCAL_CONTEXT as RCA }               from './fiscalite-rca'
import { MIAA_FISCAL_CONTEXT as GUINEE_EQUATORIALE } from './fiscalite-guinee-equatoriale'
import { MIAA_FISCAL_CONTEXT as RDC }               from './fiscalite-rdc'

export interface MiaaFiscalContext {
  country:               string
  countryName:           string
  currency:              string
  administrationFiscale: string
  systemeFiscal:         string
  expertName:            string
  dataConfidence:        'verified' | 'estimated' | 'to_verify'
  specificites:          readonly string[]
}

// ── Détection du pays mentionné dans un message utilisateur ──────────────────
// Chaque code pays → liste de mots-clés en minuscules
const PAYS_KEYWORDS: Record<string, string[]> = {
  CG: ['congo-brazzaville', 'congo brazzaville', 'brazzaville', 'republic of congo'],
  CM: ['cameroun', 'cameroon', 'camerounais', 'cameroonian'],
  GA: ['gabon', 'gabonais', 'gabonese'],
  TD: ['tchad', 'tchadien', 'chad', 'chadian'],
  CF: ['centrafrique', 'centrafricaine', 'rca', 'central african republic', 'república centroafricana'],
  GQ: ['guinée équatoriale', 'guinee equatoriale', 'equatorial guinea', 'guinea ecuatorial', 'guinée-équatoriale'],
  CD: ['rdc', 'rd congo', 'congo kinshasa', 'congo-kinshasa', 'kinshasa',
       'république démocratique du congo', 'republique democratique du congo',
       'democratic republic of the congo', 'drc'],
}

export function detecterPaysMentionne(message: string): string | null {
  const lower = message.toLowerCase()
  for (const [code, keywords] of Object.entries(PAYS_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return code
  }
  return null
}

// ── Noms des pays sans moteur (pour messages fallback) ────────────────────────
const PAYS_SANS_MOTEUR_NOMS: Record<string, string> = {
  ML: 'Mali', CI: "Côte d'Ivoire", SN: 'Sénégal', BF: 'Burkina Faso',
  NE: 'Niger', NG: 'Nigéria', ZA: 'Afrique du Sud', KE: 'Kenya',
  ET: 'Éthiopie', RW: 'Rwanda', EG: 'Égypte', MA: 'Maroc',
  TN: 'Tunisie', DZ: 'Algérie', AO: 'Angola', GW: 'Guinée-Bissau',
}

export function getNomPaysSansMoteur(code: string): string {
  return PAYS_SANS_MOTEUR_NOMS[code] ?? code
}

// ── Clause réforme RDC — injectée dans tous les prompts RDC
const RDC_REFORME_CLAUSE = `⚠️ CLAUSE RÉFORME OBLIGATOIRE — RDC : Une réforme fiscale majeure (Lois n°23/052 et n°23/053 du 30 novembre 2023, LF N°25/060 du 29/12/2025) est entrée en vigueur le 1er janvier 2026. La terminologie officielle est IBP (Impôt sur Bénéfices et Profits) et IPR (Impôt Professionnel sur Rémunérations) — et non plus "IS" et "IRPP". Si l'utilisateur fait référence à l'ancien système, signale-lui explicitement ce changement avant de répondre.`

// ── Clause IPR RDC — barème officiel LF 2025, interdiction barème alternatif
const RDC_IPR_CLAUSE = `\n\nBARÈME IPR OFFICIEL — SOURCE : LF N°25/060 DU 29/12/2025 (Ministère des Finances RDC)
IPR = Impôt Professionnel sur les Rémunérations (remplace IRPP dans terminologie officielle 2025)
Barème marginal progressif annuel (Francs Congolais) :
  0%    : 0 – 524 160 FC
  15%   : 524 161 – 1 428 000 FC
  20%   : 1 428 001 – 2 700 000 FC
  22,5% : 2 700 001 – 4 620 000 FC
  25%   : 4 620 001 – 7 260 000 FC
  30%   : 7 260 001 – 10 260 000 FC
  32,5% : 10 260 001 – 13 908 000 FC
  35%   : 13 908 001 – 16 824 000 FC
  37,5% : 16 824 001 – 22 956 000 FC
  40%   : au-delà de 22 956 001 FC
Exonération : personnel diplomatique (Convention de Vienne)

INTERDICTION ABSOLUE : Ne génère JAMAIS un barème IPR/IRPP avec des tranches exprimées en dizaines de millions FC (60 000 000 / 120 000 000 / 300 000 000 / 600 000 000 FC etc.). Ce barème est INCORRECT pour la RDC. Le barème officiel plafonne sa première tranche imposable à 1 428 000 FC, pas à 60 000 000 FC.

IBP RÉGIMES SPÉCIAUX (LF N°25/060) :
  - Standard : 30% bénéfice net
  - Petites Entreprises : 1% sur ventes / 2% sur prestations de services
  - Micro-entreprises : forfait fixe 30 000 FC
  - Impôt minimum (si déficit) : 1% CA — planchers : 2 500 000 FC (GE) / 750 000 FC (ME) / 30 000 FC (PE)
IERE (expatriés) : 25%
IM (capitaux mobiliers) : 20%
IRS (services non-résidents) : 14%`

export function getMiaaFiscalContext(countryCode: string): MiaaFiscalContext | null {
  switch (countryCode) {
    case 'CG': return CONGO as MiaaFiscalContext
    case 'CM': return CAMEROUN as MiaaFiscalContext
    case 'GA': return GABON as MiaaFiscalContext
    case 'TD': return TCHAD as MiaaFiscalContext
    case 'CF': return RCA as MiaaFiscalContext
    case 'GQ': return GUINEE_EQUATORIALE as MiaaFiscalContext
    case 'CD': return RDC as MiaaFiscalContext
    default:   return null
  }
}

export function getMiaaFiscalSystemPrompt(countryCode: string): string {
  const code = countryCode === 'CD_USD' ? 'CD' : countryCode
  const ctx = getMiaaFiscalContext(code)

  if (!ctx) {
    const countryNames: Record<string, string> = {
      ML: 'Mali', CI: "Côte d'Ivoire", SN: 'Sénégal', BF: 'Burkina Faso',
      NE: 'Niger', NG: 'Nigéria', ZA: 'Afrique du Sud', KE: 'Kenya',
      ET: 'Éthiopie', RW: 'Rwanda', EG: 'Égypte', MA: 'Maroc',
      TN: 'Tunisie', DZ: 'Algérie', AO: 'Angola', GW: 'Guinée-Bissau',
    }
    const nom = countryNames[code] ?? 'ce pays'
    return `Le module fiscal spécialisé pour ${nom} est en cours de développement. Je peux donner des informations générales sur la fiscalité africaine et OHADA, mais je recommande de consulter un expert-comptable local pour les règles spécifiques à ${nom}.`
  }

  const fiabilite =
    ctx.dataConfidence === 'verified'  ? 'Données vérifiées — sources officielles' :
    ctx.dataConfidence === 'estimated' ? 'Données partiellement estimées — à confirmer pour usage officiel' :
                                         'Données à vérifier — confirmer auprès de l\'administration fiscale locale'

  const rdcClause = code === 'CD' ? `\n\n${RDC_REFORME_CLAUSE}${RDC_IPR_CLAUSE}` : ''

  return `Tu es ${ctx.expertName}, expert fiscal spécialisé en ${ctx.countryName}.
Administration de référence : ${ctx.administrationFiscale}
Système fiscal : ${ctx.systemeFiscal}
Devise : ${ctx.currency}
Fiabilité des données : ${fiabilite}

Particularités fiscales de ${ctx.countryName} :
${ctx.specificites.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Réponds UNIQUEMENT avec les taux et règles de ${ctx.countryName} listés ci-dessus. Si une information précise n'est pas disponible dans ce contexte fiscal, dis-le explicitement plutôt que de compléter avec des connaissances générales non vérifiées. Si une donnée est marquée "to_verify" ou "estimated", précise à l'utilisateur qu'elle doit être confirmée auprès d'un expert-comptable local ou de l'${ctx.administrationFiscale} avant usage officiel.${rdcClause}`
}
