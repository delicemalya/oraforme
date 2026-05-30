// Country config for IP-based geolocation + currency formatting
// 21 countries: OHADA + Maghreb + Nigeria + Kenya + Ghana + France + US

export interface PaysGeo {
  code: string
  nom: string
  drapeau: string
  devise: string
  symbole: string
  locale: string
  zone: 'CEMAC' | 'UEMOA' | 'autre' | 'UE' | 'anglophone' | 'maghreb'
  smig?: number
  langue_officielle: string
}

export const PAYS_CONFIG: Record<string, PaysGeo> = {
  CG: { code: 'CG', nom: 'Congo-Brazzaville', drapeau: '🇨🇬', devise: 'FCFA', symbole: '₣', locale: 'fr-CG', zone: 'CEMAC', smig: 90_000, langue_officielle: 'fr' },
  CM: { code: 'CM', nom: 'Cameroun',           drapeau: '🇨🇲', devise: 'FCFA', symbole: '₣', locale: 'fr-CM', zone: 'CEMAC', smig: 41_875, langue_officielle: 'fr' },
  GA: { code: 'GA', nom: 'Gabon',              drapeau: '🇬🇦', devise: 'FCFA', symbole: '₣', locale: 'fr-GA', zone: 'CEMAC', smig: 150_000, langue_officielle: 'fr' },
  CD: { code: 'CD', nom: 'RD Congo (Kinshasa)',drapeau: '🇨🇩', devise: 'CDF',  symbole: 'FC', locale: 'fr-CD', zone: 'CEMAC', langue_officielle: 'fr' },
  SN: { code: 'SN', nom: 'Sénégal',            drapeau: '🇸🇳', devise: 'FCFA', symbole: '₣', locale: 'fr-SN', zone: 'UEMOA', smig: 69_995, langue_officielle: 'fr' },
  CI: { code: 'CI', nom: "Côte d'Ivoire",      drapeau: '🇨🇮', devise: 'FCFA', symbole: '₣', locale: 'fr-CI', zone: 'UEMOA', smig: 75_000, langue_officielle: 'fr' },
  ML: { code: 'ML', nom: 'Mali',               drapeau: '🇲🇱', devise: 'FCFA', symbole: '₣', locale: 'fr-ML', zone: 'UEMOA', smig: 40_000, langue_officielle: 'fr' },
  BF: { code: 'BF', nom: 'Burkina Faso',       drapeau: '🇧🇫', devise: 'FCFA', symbole: '₣', locale: 'fr-BF', zone: 'UEMOA', smig: 34_664, langue_officielle: 'fr' },
  TG: { code: 'TG', nom: 'Togo',               drapeau: '🇹🇬', devise: 'FCFA', symbole: '₣', locale: 'fr-TG', zone: 'UEMOA', smig: 35_000, langue_officielle: 'fr' },
  BJ: { code: 'BJ', nom: 'Bénin',              drapeau: '🇧🇯', devise: 'FCFA', symbole: '₣', locale: 'fr-BJ', zone: 'UEMOA', smig: 40_000, langue_officielle: 'fr' },
  NE: { code: 'NE', nom: 'Niger',              drapeau: '🇳🇪', devise: 'FCFA', symbole: '₣', locale: 'fr-NE', zone: 'UEMOA', langue_officielle: 'fr' },
  GN: { code: 'GN', nom: 'Guinée-Conakry',     drapeau: '🇬🇳', devise: 'GNF',  symbole: 'FG', locale: 'fr-GN', zone: 'autre', smig: 440_000, langue_officielle: 'fr' },
  AO: { code: 'AO', nom: 'Angola',             drapeau: '🇦🇴', devise: 'AOA',  symbole: 'Kz', locale: 'pt-AO', zone: 'autre', langue_officielle: 'pt' },
  MZ: { code: 'MZ', nom: 'Mozambique',         drapeau: '🇲🇿', devise: 'MZN',  symbole: 'MT', locale: 'pt-MZ', zone: 'autre', langue_officielle: 'pt' },
  MA: { code: 'MA', nom: 'Maroc',              drapeau: '🇲🇦', devise: 'MAD',  symbole: 'DH', locale: 'fr-MA', zone: 'maghreb', smig: 3_111, langue_officielle: 'ar' },
  DZ: { code: 'DZ', nom: 'Algérie',            drapeau: '🇩🇿', devise: 'DZD',  symbole: 'DA', locale: 'fr-DZ', zone: 'maghreb', smig: 20_000, langue_officielle: 'ar' },
  TN: { code: 'TN', nom: 'Tunisie',            drapeau: '🇹🇳', devise: 'TND',  symbole: 'DT', locale: 'fr-TN', zone: 'maghreb', langue_officielle: 'ar' },
  NG: { code: 'NG', nom: 'Nigeria',            drapeau: '🇳🇬', devise: 'NGN',  symbole: '₦', locale: 'en-NG', zone: 'anglophone', langue_officielle: 'en' },
  KE: { code: 'KE', nom: 'Kenya',              drapeau: '🇰🇪', devise: 'KES',  symbole: 'KSh', locale: 'en-KE', zone: 'anglophone', langue_officielle: 'en' },
  GH: { code: 'GH', nom: 'Ghana',              drapeau: '🇬🇭', devise: 'GHS',  symbole: '₵', locale: 'en-GH', zone: 'anglophone', langue_officielle: 'en' },
  FR: { code: 'FR', nom: 'France',             drapeau: '🇫🇷', devise: 'EUR',  symbole: '€', locale: 'fr-FR', zone: 'UE', smig: 1_767, langue_officielle: 'fr' },
  US: { code: 'US', nom: 'États-Unis',         drapeau: '🇺🇸', devise: 'USD',  symbole: '$', locale: 'en-US', zone: 'autre', langue_officielle: 'en' },
}

export const PAYS_GEO_LIST = Object.values(PAYS_CONFIG)

export function getPaysGeo(code: string): PaysGeo {
  return PAYS_CONFIG[code] ?? PAYS_CONFIG['CG']
}

// IP country code → app country code (some ISPs report differently)
const COUNTRY_CODE_MAP: Record<string, string> = {
  CD: 'CD', CG: 'CG', CM: 'CM', GA: 'GA', CF: 'CG', TD: 'CG',
  SN: 'SN', CI: 'CI', ML: 'ML', BF: 'BF', TG: 'TG', BJ: 'BJ',
  NE: 'NE', GN: 'GN', AO: 'AO', MZ: 'MZ', MA: 'MA', DZ: 'DZ',
  TN: 'TN', NG: 'NG', KE: 'KE', GH: 'GH', FR: 'FR', BE: 'FR',
  CH: 'FR', US: 'US', CA: 'US', GB: 'US',
}

export function mapIpCountryToAppCode(ipCountry: string): string {
  return COUNTRY_CODE_MAP[ipCountry] ?? 'CG'
}

export function formaterMontant(montant: number, code: string): string {
  const pays = getPaysGeo(code)
  if (pays.devise === 'EUR') {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(montant)
  }
  if (pays.devise === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(montant)
  }
  if (pays.devise === 'CHF') {
    return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 2 }).format(montant)
  }
  // FCFA and other non-decimal currencies
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(montant)) + ' ' + pays.devise
}
