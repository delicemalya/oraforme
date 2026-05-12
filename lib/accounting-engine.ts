import { supabase } from '@/lib/supabase'

export type AccountCode = string

// OHADA chart of accounts displayed in UI dropdowns
export const OHADA_ACCOUNTS = [
  { number: '521000', name: 'Banque',                         type: 'tresorerie' },
  { number: '571000', name: 'Caisse',                         type: 'tresorerie' },
  { number: '411000', name: 'Clients',                        type: 'actif'      },
  { number: '401000', name: 'Fournisseurs',                   type: 'passif'     },
  { number: '421000', name: 'Personnel — Rémunérations dues', type: 'passif'     },
  { number: '431000', name: 'CNSS — Sécurité sociale',        type: 'passif'     },
  { number: '441000', name: 'État — TVA collectée',           type: 'passif'     },
  { number: '601000', name: 'Achats de marchandises',         type: 'charge'     },
  { number: '641000', name: 'Rémunérations du personnel',     type: 'charge'     },
  { number: '644000', name: 'Charges sociales patronales',    type: 'charge'     },
  { number: '651000', name: 'Charges locatives et loyers',    type: 'charge'     },
  { number: '706000', name: 'Prestations de services',        type: 'produit'    },
  { number: '707000', name: 'Ventes de marchandises',         type: 'produit'    },
  { number: '708000', name: 'Transport facturé',              type: 'produit'    },
  { number: '709000', name: "Autres produits d'exploitation", type: 'produit'    },
] as const

// Default debit/credit mapping by {type, categorie}
const ACCOUNT_MAP: Record<string, Record<string, [AccountCode, AccountCode]>> = {
  entree: {
    'Vente':          ['571000', '707000'],
    'Facture payée':  ['521000', '411000'],
    'Avance client':  ['571000', '411000'],
    'Prestation':     ['571000', '706000'],
    'Virement reçu':  ['521000', '709000'],
    'Remboursement':  ['571000', '409000'],
    '__default':      ['571000', '709000'],
  },
  sortie: {
    'Salaires':          ['641000', '571000'],
    'Salaires & CNSS':   ['641000', '571000'],
    'CNSS':              ['644000', '431000'],
    'Loyer':             ['651000', '571000'],
    'Achats':            ['601000', '401000'],
    'Carburant':         ['601000', '571000'],
    'Taxes':             ['441000', '521000'],
    'Charges':           ['651000', '571000'],
    '__default':         ['651000', '571000'],
  },
}

export function resolveAccounts(
  type: 'entree' | 'sortie',
  categorie: string,
): [AccountCode, AccountCode] {
  const map = ACCOUNT_MAP[type] ?? {}
  return map[categorie] ?? map['__default'] ?? ['571000', '709000']
}

export function accountLabel(number: AccountCode): string {
  const found = OHADA_ACCOUNTS.find(a => a.number === number)
  return found ? `${found.number} — ${found.name}` : number
}

export type JournalEntryInput = {
  tenant_id: string
  date_operation: string
  libelle: string
  debit_account: AccountCode
  credit_account: AccountCode
  montant: number
  source?: string
  source_id?: string
  fiscal_year?: number
  created_by?: string
}

export async function createJournalEntry(entry: JournalEntryInput) {
  const { error } = await supabase.from('journal_entries').insert({
    ...entry,
    fiscal_year: entry.fiscal_year ?? new Date(entry.date_operation).getFullYear(),
  })
  return { error }
}

// Upsert the fiscal year opening balance (N-1 solde)
export async function setOpeningBalance(params: {
  tenant_id: string
  annee: number
  solde_ouverture: number
}) {
  const { error } = await supabase.from('fiscal_years').upsert(
    {
      tenant_id:       params.tenant_id,
      annee:           params.annee,
      solde_ouverture: params.solde_ouverture,
      date_ouverture:  `${params.annee}-01-01`,
    },
    { onConflict: 'tenant_id,annee' },
  )
  return { error }
}

// Load the opening balance for a given year
export async function getOpeningBalance(tenant_id: string, annee: number): Promise<number> {
  const { data } = await supabase
    .from('fiscal_years')
    .select('solde_ouverture')
    .eq('tenant_id', tenant_id)
    .eq('annee', annee)
    .maybeSingle()
  return data?.solde_ouverture ?? 0
}
