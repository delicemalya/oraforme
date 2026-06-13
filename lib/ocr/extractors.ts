/**
 * lib/ocr/extractors.ts
 *
 * Extracteurs spécialisés : transforment le texte OCR brut en données structurées
 * via l'IA (Mistral ou Claude). Chaque extracteur retourne un objet JSON typé.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InvoiceData {
  numero?:       string
  date?:         string
  echeance?:     string
  client?:       string
  adresse?:      string
  tva?:          string
  montant_ht?:   string
  montant_ttc?:  string
  lignes?:       Array<{ description: string; quantite: string; prix: string; total: string }>
  iban?:         string
  rccm?:         string
  confidence:    number
  suggestion?:   string
}

export interface CVData {
  nom?:          string
  email?:        string
  telephone?:    string
  adresse?:      string
  titre?:        string
  resume?:       string
  competences?:  string[]
  langues?:      string[]
  diplomes?:     Array<{ titre: string; etablissement: string; annee: string }>
  experiences?:  Array<{ poste: string; entreprise: string; debut: string; fin: string; description: string }>
  score?:        number   // 0-100, calculé par l'IA
  recommandation?: string
  confidence:    number
}

export interface ContractData {
  type?:         string   // CDI, CDD, Prestation, Location…
  parties?:      Array<{ role: string; nom: string; adresse?: string }>
  date_debut?:   string
  date_fin?:     string
  duree?:        string
  montant?:      string
  clauses_cles?: string[]
  risques?:      string[]
  obligations?:  string[]
  rapport?:      string
  confidence:    number
}

export interface IdentityData {
  type?:         string   // CNI, Passeport, Permis…
  nom?:          string
  prenom?:       string
  date_naissance?: string
  lieu_naissance?: string
  nationalite?:  string
  numero?:       string
  date_expiration?: string
  confidence:    number
}

export interface FiscalData {
  type?:         string   // TVA, IS, IRPP, CNSS, Patente…
  periode?:      string
  montant?:      string
  base_impos?:   string
  taux?:         string
  reference?:    string
  entreprise?:   string
  niu?:          string
  statut?:       string
  confidence:    number
}

// ── AI extraction helper ───────────────────────────────────────────────────────

async function extractWithAI<T>(text: string, prompt: string): Promise<T & { confidence: number }> {
  const apiKey = process.env.MISTRAL_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Aucune clé API IA configurée')

  const useMistral = !!process.env.MISTRAL_API_KEY
  const systemPrompt = `Tu es un expert en extraction de données de documents.
Extrais les informations demandées et retourne UNIQUEMENT un JSON valide sans markdown.
Si une information est absente, utilise null. Ajoute un champ "confidence" de 0 à 1.`

  let responseText = ''

  if (useMistral) {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${prompt}\n\nTEXTE DU DOCUMENT:\n${text.slice(0, 8000)}` },
        ],
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    })
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    responseText = json.choices?.[0]?.message?.content ?? '{}'
  } else {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: `${prompt}\n\nTEXTE DU DOCUMENT:\n${text.slice(0, 8000)}` }],
      }),
    })
    const json = await res.json() as { content?: Array<{ type: string; text?: string }> }
    responseText = json.content?.find(b => b.type === 'text')?.text ?? '{}'
  }

  try {
    const clean = responseText.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as T & { confidence: number }
  } catch {
    return { confidence: 0 } as T & { confidence: number }
  }
}

// ── extractInvoice ─────────────────────────────────────────────────────────────

export async function extractInvoice(ocrText: string): Promise<InvoiceData> {
  const prompt = `Extrait les données de cette FACTURE ou DEVIS (contexte Congo/OHADA/CEMAC) :
- numero : numéro de facture/devis
- date : date d'émission (format DD/MM/YYYY)
- echeance : date d'échéance de paiement
- client : nom/raison sociale du client
- adresse : adresse du client
- montant_ht : montant hors taxes
- tva : montant TVA (18% Congo)
- montant_ttc : montant total TTC
- lignes : tableau des lignes [{description, quantite, prix, total}]
- iban / rib : coordonnées bancaires
- rccm : numéro RCCM si présent
- suggestion : action Oraforme recommandée (ex: "Créer cette facture dans le module Facturation")

Retourne un JSON.`

  const result = await extractWithAI<InvoiceData>(ocrText, prompt)
  if (!result.suggestion && result.numero) {
    result.suggestion = `Créer automatiquement la facture ${result.numero} pour ${result.client ?? 'ce client'} (${result.montant_ttc ?? '?'}) dans Oraforme ?`
  }
  return result
}

// ── extractCV ──────────────────────────────────────────────────────────────────

export async function extractCV(ocrText: string): Promise<CVData> {
  const prompt = `Extrais les données de ce CV (contexte Afrique centrale / Congo) :
- nom : nom complet
- email, telephone, adresse
- titre : intitulé du poste recherché
- resume : résumé professionnel
- competences : tableau de compétences techniques
- langues : langues maîtrisées avec niveau
- diplomes : [{titre, etablissement, annee}]
- experiences : [{poste, entreprise, debut, fin, description}]
- score : score de recrutement de 0 à 100 basé sur la qualité du profil (expérience, diplômes, cohérence)
- recommandation : phrase d'évaluation pour le recruteur

Retourne un JSON.`

  return extractWithAI<CVData>(ocrText, prompt)
}

// ── extractContract ────────────────────────────────────────────────────────────

export async function extractContract(ocrText: string): Promise<ContractData> {
  const prompt = `Analyse ce CONTRAT (droit OHADA, Congo-Brazzaville) :
- type : type de contrat (CDI, CDD, Prestation de services, Location, Vente, etc.)
- parties : [{role: "employeur"|"employé"|"prestataire"|"client", nom, adresse}]
- date_debut : date de début
- date_fin : date de fin ou null si CDI/indéterminé
- duree : durée (ex: "12 mois", "indéterminée")
- montant : valeur financière du contrat si applicable
- clauses_cles : tableau des clauses importantes (max 5)
- risques : risques juridiques identifiés (max 3)
- obligations : obligations principales des parties (max 5)
- rapport : résumé d'analyse en 2-3 phrases

Retourne un JSON.`

  return extractWithAI<ContractData>(ocrText, prompt)
}

// ── extractIdentityCard ────────────────────────────────────────────────────────

export async function extractIdentityCard(ocrText: string): Promise<IdentityData> {
  const prompt = `Extrais les données de cette PIÈCE D'IDENTITÉ (CNI, Passeport, Permis, carte CNSS…) :
- type : type du document
- nom : nom de famille
- prenom : prénom(s)
- date_naissance : date de naissance (DD/MM/YYYY)
- lieu_naissance : lieu de naissance
- nationalite : nationalité
- numero : numéro du document
- date_expiration : date d'expiration

Retourne un JSON.`

  return extractWithAI<IdentityData>(ocrText, prompt)
}

// ── extractFiscalDocument ──────────────────────────────────────────────────────

export async function extractFiscalDocument(ocrText: string): Promise<FiscalData> {
  const prompt = `Analyse ce DOCUMENT FISCAL (contexte Congo-Brazzaville, DGI, CNSS, OHADA) :
- type : type (Déclaration TVA, Avis IS, Quittance CNSS, Attestation patente, Avis IRPP, DAS, etc.)
- periode : période concernée (ex: "T3 2026", "Mai 2026")
- montant : montant à payer ou payé
- base_impos : base d'imposition
- taux : taux appliqué
- reference : numéro de référence/quittance
- entreprise : nom de l'entreprise contribuable
- niu : Numéro d'Identification Unique (NIU) si présent
- statut : "payé", "à payer", "en retard", "exonéré"

Retourne un JSON.`

  return extractWithAI<FiscalData>(ocrText, prompt)
}

// ── Auto-detect document type ──────────────────────────────────────────────────

export async function detectDocumentType(ocrText: string): Promise<{
  type: 'invoice' | 'cv' | 'contract' | 'identity' | 'fiscal' | 'other'
  confidence: number
}> {
  const lower = ocrText.toLowerCase()
  const scores = {
    invoice:  0,
    cv:       0,
    contract: 0,
    identity: 0,
    fiscal:   0,
    other:    0,
  }

  // Heuristiques rapides
  if (/facture|invoice|devis|montant ht|tva|ttc|client|rccm/.test(lower)) scores.invoice += 3
  if (/curriculum|expérience professionnelle|formation|compétences|diplôme/.test(lower)) scores.cv += 3
  if (/contrat|entre les soussignés|article|clause|obligations|parties/.test(lower)) scores.contract += 3
  if (/né le|date de naissance|nationalité|numéro national|passeport|carte nationale/.test(lower)) scores.identity += 3
  if (/taxe|tva|impôt|déclaration|cnss|niu|dgimpôts|cotisation|patente/.test(lower)) scores.fiscal += 3

  const best = (Object.entries(scores) as Array<[keyof typeof scores, number]>)
    .reduce((a, b) => b[1] > a[1] ? b : a)

  return { type: best[0] as 'invoice' | 'cv' | 'contract' | 'identity' | 'fiscal' | 'other', confidence: Math.min(1, best[1] / 5) }
}
