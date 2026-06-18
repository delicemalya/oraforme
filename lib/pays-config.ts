// Registre des pays supportés par Oraforme
// fiscaliteDisponible : moteur fiscal complet disponible
// getMoteurFiscal     : retourne le slug du moteur ou null (pas encore implémenté)

export interface PaysDisponible {
  code:                 string
  nom:                  string
  drapeau:              string
  devise:               string
  fiscaliteDisponible:  boolean
}

export const PAYS_DISPONIBLES: PaysDisponible[] = [
  { code: 'CG', nom: 'Congo-Brazzaville',           drapeau: '🇨🇬', devise: 'XAF', fiscaliteDisponible: true  },
  { code: 'CM', nom: 'Cameroun',                     drapeau: '🇨🇲', devise: 'XAF', fiscaliteDisponible: true  },
  { code: 'GA', nom: 'Gabon',                        drapeau: '🇬🇦', devise: 'XAF', fiscaliteDisponible: false },
  { code: 'TD', nom: 'Tchad',                        drapeau: '🇹🇩', devise: 'XAF', fiscaliteDisponible: false },
  { code: 'CF', nom: 'République Centrafricaine',    drapeau: '🇨🇫', devise: 'XAF', fiscaliteDisponible: false },
  { code: 'CD', nom: 'RD Congo',                     drapeau: '🇨🇩', devise: 'CDF', fiscaliteDisponible: false },
  { code: 'ML', nom: 'Mali',                         drapeau: '🇲🇱', devise: 'XOF', fiscaliteDisponible: false },
  { code: 'CI', nom: "Côte d'Ivoire",                drapeau: '🇨🇮', devise: 'XOF', fiscaliteDisponible: false },
  { code: 'SN', nom: 'Sénégal',                      drapeau: '🇸🇳', devise: 'XOF', fiscaliteDisponible: false },
  { code: 'GQ', nom: 'Guinée Équatoriale',           drapeau: '🇬🇶', devise: 'XAF', fiscaliteDisponible: false },
  { code: 'GW', nom: 'Guinée-Bissau',                drapeau: '🇬🇼', devise: 'XOF', fiscaliteDisponible: false },
  { code: 'BF', nom: 'Burkina Faso',                 drapeau: '🇧🇫', devise: 'XOF', fiscaliteDisponible: false },
  { code: 'NE', nom: 'Niger',                        drapeau: '🇳🇪', devise: 'XOF', fiscaliteDisponible: false },
  { code: 'NG', nom: 'Nigéria',                      drapeau: '🇳🇬', devise: 'NGN', fiscaliteDisponible: false },
  { code: 'ZA', nom: 'Afrique du Sud',               drapeau: '🇿🇦', devise: 'ZAR', fiscaliteDisponible: false },
  { code: 'KE', nom: 'Kenya',                        drapeau: '🇰🇪', devise: 'KES', fiscaliteDisponible: false },
  { code: 'ET', nom: 'Éthiopie',                     drapeau: '🇪🇹', devise: 'ETB', fiscaliteDisponible: false },
  { code: 'RW', nom: 'Rwanda',                       drapeau: '🇷🇼', devise: 'RWF', fiscaliteDisponible: false },
  { code: 'EG', nom: 'Égypte',                       drapeau: '🇪🇬', devise: 'EGP', fiscaliteDisponible: false },
  { code: 'MA', nom: 'Maroc',                        drapeau: '🇲🇦', devise: 'MAD', fiscaliteDisponible: false },
  { code: 'TN', nom: 'Tunisie',                      drapeau: '🇹🇳', devise: 'TND', fiscaliteDisponible: false },
  { code: 'DZ', nom: 'Algérie',                      drapeau: '🇩🇿', devise: 'DZD', fiscaliteDisponible: false },
  { code: 'FR', nom: 'France',                       drapeau: '🇫🇷', devise: 'EUR', fiscaliteDisponible: false },
  { code: 'BE', nom: 'Belgique',                     drapeau: '🇧🇪', devise: 'EUR', fiscaliteDisponible: false },
  { code: 'CH', nom: 'Suisse',                       drapeau: '🇨🇭', devise: 'CHF', fiscaliteDisponible: false },
  { code: 'AO', nom: 'Angola',                       drapeau: '🇦🇴', devise: 'AOA', fiscaliteDisponible: false },
]

export type MoteurFiscal = 'congo' | 'cameroun'

export function getMoteurFiscal(codePays: string): MoteurFiscal | null {
  switch (codePays) {
    case 'CG': return 'congo'
    case 'CM': return 'cameroun'
    default:   return null
  }
}

export function getPaysDisponible(code: string): PaysDisponible | undefined {
  return PAYS_DISPONIBLES.find(p => p.code === code)
}
