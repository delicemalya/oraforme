/**
 * Seed 5 employés de test pour adjigordon@gmail.com
 * Colonnes DB réelles (probing 2026-06-21) :
 *   nom, postnom, prenom, sexe, date_naissance, nationalite,
 *   situation_matrimoniale, nb_enfants, telephone, telephone2, email_pro,
 *   adresse, ville, pays, photo_url, poste, departement, type_employe, statut,
 *   date_recrutement, date_debut_contrat, date_fin_contrat, periode_essai,
 *   salaire_base, salaire_brut, taux_horaire, prime_logement, prime_transport,
 *   prime_risque, prime_rendement, numero_cnss, numero_fiscal,
 *   mode_paiement, banque, rib, mobile_money_type, mobile_money_numero,
 *   manager, matricule, type_travailleur, categorie_emploi,
 *   situation_familiale, nombre_enfants, nombre_parts, indemnite_vie_chere
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = 'https://mrzixapnaqsbqmagivvf.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant — requis pour seed-employes-test')
const TENANT_ID    = '64c244e5-02fd-4cf7-a56f-b0bdd48fdc09'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Supprime les anciens employés de test
await sb.from('employes').delete()
  .eq('tenant_id', TENANT_ID)
  .in('nom', ['MBOUNGOU', 'NZABA', 'KIMBEMBE', 'MOUKALA', 'DIALLO'])

const employes = [
  {
    // ── 1. CDI Senior directeur commercial — SCORE VERT (dossier complet)
    tenant_id:              TENANT_ID,
    nom:                    'MBOUNGOU',
    postnom:                'Jean-Pierre',
    prenom:                 'Jean-Pierre',
    sexe:                   'M',
    date_naissance:         '1985-07-14',
    nationalite:            'Congolaise',
    situation_matrimoniale: 'marie',
    situation_familiale:    'marie',
    nb_enfants:             3,
    nombre_enfants:         3,
    nombre_parts:           4.5,
    telephone:              '+242 06 512 3456',
    email_pro:              'jp.mboungou@amdfinance.cg',
    adresse:                '14 Avenue de la Paix, Bacongo',
    ville:                  'Brazzaville',
    pays:                   'CG',
    poste:                  'Directeur Commercial',
    departement:            'Direction Commerciale',
    type_employe:           'cdi',
    statut:                 'actif',
    date_recrutement:       '2019-03-01',
    date_debut_contrat:     '2019-03-15',
    salaire_base:           850_000,
    salaire_brut:           1_040_000,
    prime_transport:        30_000,
    prime_logement:         80_000,
    prime_rendement:        50_000,
    prime_risque:           30_000,
    numero_cnss:            'CNSS-CG-00123456',
    numero_fiscal:          'M2009001234A',
    mode_paiement:          'banque',
    banque:                 'BGFI Bank Congo',
    rib:                    '00002 03234 0000789012 56',
    matricule:              'AMD-001',
    manager:                'Direction Générale',
    categorie_emploi:       'cadre_superieur',
    type_travailleur:       'permanent',
  },
  {
    // ── 2. CDD comptable — ALERTE contrat expiré
    tenant_id:              TENANT_ID,
    nom:                    'NZABA',
    postnom:                'Christelle',
    prenom:                 'Christelle',
    sexe:                   'F',
    date_naissance:         '1992-11-30',
    nationalite:            'Congolaise',
    situation_matrimoniale: 'celibataire',
    situation_familiale:    'celibataire',
    nb_enfants:             0,
    nombre_enfants:         0,
    nombre_parts:           1,
    telephone:              '+242 05 678 9012',
    email_pro:              'c.nzaba@amdfinance.cg',
    adresse:                '7 Rue du Commerce, Poto-Poto',
    ville:                  'Brazzaville',
    pays:                   'CG',
    poste:                  'Comptable Senior',
    departement:            'Finance & Comptabilité',
    type_employe:           'cdd',
    statut:                 'actif',
    date_recrutement:       '2023-01-15',
    date_debut_contrat:     '2023-02-01',
    date_fin_contrat:       '2025-07-31',
    salaire_base:           420_000,
    salaire_brut:           450_000,
    prime_transport:        30_000,
    numero_cnss:            'CNSS-CG-00234567',
    numero_fiscal:          'F2015002345B',
    mode_paiement:          'mobile_money',
    mobile_money_type:      'airtel_money',
    mobile_money_numero:    '+242 05 678 9012',
    matricule:              'AMD-002',
    categorie_emploi:       'cadre',
    type_travailleur:       'contractuel',
  },
  {
    // ── 3. Stagiaire — SCORE ROUGE (pas de CNSS, pas de fiscal, salaire = SMIG)
    tenant_id:              TENANT_ID,
    nom:                    'KIMBEMBE',
    postnom:                'Rodrigue',
    prenom:                 'Rodrigue',
    sexe:                   'M',
    date_naissance:         '2001-03-22',
    nationalite:            'Congolaise',
    situation_matrimoniale: 'celibataire',
    situation_familiale:    'celibataire',
    nb_enfants:             0,
    nombre_enfants:         0,
    nombre_parts:           1,
    telephone:              '+242 06 901 2345',
    adresse:                '3 Rue Moukounzi, Bacongo',
    ville:                  'Pointe-Noire',
    pays:                   'CG',
    poste:                  'Stagiaire Développeur',
    departement:            'Informatique',
    type_employe:           'stage',
    statut:                 'actif',
    date_recrutement:       '2025-09-01',
    date_debut_contrat:     '2025-09-01',
    date_fin_contrat:       '2026-02-28',
    salaire_base:           90_000,
    salaire_brut:           90_000,
    prime_transport:        0,
    prime_logement:         0,
    mode_paiement:          'mobile_money',
    mobile_money_type:      'mtn_momo',
    mobile_money_numero:    '+242 06 901 2345',
    matricule:              'AMD-003',
    categorie_emploi:       'stagiaire',
    type_travailleur:       'stagiaire',
  },
  {
    // ── 4. CDI RH en congé — 8 ans ancienneté — SCORE ORANGE
    tenant_id:              TENANT_ID,
    nom:                    'MOUKALA',
    postnom:                'Patience',
    prenom:                 'Patience',
    sexe:                   'F',
    date_naissance:         '1988-02-28',
    nationalite:            'Congolaise',
    situation_matrimoniale: 'marie',
    situation_familiale:    'marie',
    nb_enfants:             2,
    nombre_enfants:         2,
    nombre_parts:           3,
    telephone:              '+242 05 234 5678',
    telephone2:             '+242 06 111 2222',
    email_pro:              'p.moukala@amdfinance.cg',
    adresse:                '22 Boulevard Lyautey, Moungali',
    ville:                  'Brazzaville',
    pays:                   'CG',
    poste:                  'Responsable RH',
    departement:            'Ressources Humaines',
    type_employe:           'cdi',
    statut:                 'conge',
    date_recrutement:       '2017-06-01',
    date_debut_contrat:     '2017-07-01',
    salaire_base:           560_000,
    salaire_brut:           680_000,
    prime_transport:        30_000,
    prime_logement:         60_000,
    prime_rendement:        30_000,
    prime_risque:           0,
    numero_cnss:            'CNSS-CG-00345678',
    mode_paiement:          'banque',
    banque:                 'Ecobank Congo',
    rib:                    '00003 04567 0001234567 89',
    matricule:              'AMD-004',
    manager:                'Direction Générale',
    categorie_emploi:       'cadre',
    type_travailleur:       'permanent',
  },
  {
    // ── 5. Freelance international — salaire très élevé
    tenant_id:              TENANT_ID,
    nom:                    'DIALLO',
    postnom:                'Mamadou',
    prenom:                 'Mamadou',
    sexe:                   'M',
    date_naissance:         '1978-09-15',
    nationalite:            'Sénégalaise',
    situation_matrimoniale: 'marie',
    situation_familiale:    'marie',
    nb_enfants:             4,
    nombre_enfants:         4,
    nombre_parts:           5,
    telephone:              '+221 77 345 6789',
    email_pro:              'm.diallo@consultants.sn',
    adresse:                'Point E, Rue 10 Angle 13, Apt 4B',
    ville:                  'Dakar',
    pays:                   'SN',
    poste:                  'Consultant Finance Senior',
    departement:            'Finance',
    type_employe:           'freelance',
    statut:                 'actif',
    date_recrutement:       '2024-04-01',
    date_debut_contrat:     '2024-04-01',
    salaire_base:           1_200_000,
    salaire_brut:           1_200_000,
    mode_paiement:          'banque',
    banque:                 'Société Générale Sénégal',
    rib:                    'SN08 SG001 00101234567 21',
    matricule:              'AMD-005',
    categorie_emploi:       'consultant',
    type_travailleur:       'detache',
  },
]

console.log(`\n📝 Insertion des 5 employés — tenant ${TENANT_ID}\n`)

let ok = 0
for (const emp of employes) {
  const { data, error } = await sb.from('employes').insert(emp).select('id,nom,prenom,poste,salaire_base').single()
  if (error) {
    console.error(`❌ ${emp.prenom} ${emp.nom} (${emp.poste}): ${error.message}`)
  } else {
    const label = `${data.prenom} ${data.nom} — ${data.poste}`
    console.log(`✅ ${label.padEnd(50)} ${data.salaire_base?.toLocaleString('fr-FR')} FCFA`)
    ok++
  }
}

console.log(`\n🎉 ${ok}/5 employés insérés avec succès\n`)
console.log('📊 Scénarios couverts :')
console.log('   1. MBOUNGOU Jean-Pierre  → CDI 850k  · dossier complet  · score VERT')
console.log('   2. NZABA Christelle      → CDD 420k  · contrat expiré 07/2025')
console.log('   3. KIMBEMBE Rodrigue     → Stage 90k · pas de CNSS/fiscal · score ROUGE')
console.log('   4. MOUKALA Patience      → CDI 560k  · EN CONGÉ · 8 ans ancienneté')
console.log('   5. DIALLO Mamadou        → Freelance 1.2M · non-résident Sénégal\n')
