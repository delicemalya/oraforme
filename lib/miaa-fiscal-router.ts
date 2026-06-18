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

// Clause réforme RDC — injectée dans tous les prompts RDC
const RDC_REFORME_CLAUSE = `⚠️ CLAUSE RÉFORME OBLIGATOIRE — RDC : Une réforme fiscale majeure (Lois n°23/052 et n°23/053 du 30 novembre 2023) est entrée en vigueur le 1er janvier 2026. Le système cédulaire précédent (impôts séparés par catégorie de revenus) est obsolète et remplacé par un système unifié IS + IRPP. Si l'utilisateur fait référence à l'ancien système ou pose une question qui semble se référer à des règles pré-2026, signale-lui explicitement ce changement avant de répondre.`

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
  const ctx = getMiaaFiscalContext(countryCode)

  if (!ctx) {
    const countryNames: Record<string, string> = {
      ML: 'Mali', CI: "Côte d'Ivoire", SN: 'Sénégal', BF: 'Burkina Faso',
      NE: 'Niger', NG: 'Nigéria', ZA: 'Afrique du Sud', KE: 'Kenya',
      ET: 'Éthiopie', RW: 'Rwanda', EG: 'Égypte', MA: 'Maroc',
      TN: 'Tunisie', DZ: 'Algérie', AO: 'Angola', GW: 'Guinée-Bissau',
    }
    const nom = countryNames[countryCode] ?? 'ce pays'
    return `Le module fiscal spécialisé pour ${nom} est en cours de développement. Je peux donner des informations générales sur la fiscalité africaine et OHADA, mais je recommande de consulter un expert-comptable local pour les règles spécifiques à ${nom}.`
  }

  const fiabilite =
    ctx.dataConfidence === 'verified'  ? 'Données vérifiées — sources officielles' :
    ctx.dataConfidence === 'estimated' ? 'Données partiellement estimées — à confirmer pour usage officiel' :
                                         'Données à vérifier — confirmer auprès de l\'administration fiscale locale'

  const rdcClause = countryCode === 'CD' ? `\n\n${RDC_REFORME_CLAUSE}` : ''

  return `Tu es ${ctx.expertName}, expert fiscal spécialisé en ${ctx.countryName}.
Administration de référence : ${ctx.administrationFiscale}
Système fiscal : ${ctx.systemeFiscal}
Devise : ${ctx.currency}
Fiabilité des données : ${fiabilite}

Particularités fiscales de ${ctx.countryName} :
${ctx.specificites.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Réponds uniquement avec les taux et règles de ${ctx.countryName}. Si une donnée est marquée "to_verify" ou "estimated" dans les particularités ci-dessus, précise à l'utilisateur qu'elle doit être confirmée auprès d'un expert-comptable local ou de l'${ctx.administrationFiscale} avant usage officiel.${rdcClause}`
}
