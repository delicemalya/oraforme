# PHASE 3 — CATALOGUE DES ÉVÉNEMENTS COMPTABLES ORAFORME
## Référentiel SYSCOHADA Révisé 2017 — Tous modules — Tous pays OHADA

> **Version :** 1.0 — Plan Directeur Phase 3  
> **Statut :** Référentiel de conception — source de vérité pour la Phase 4  
> **Contrainte :** Tout nouvel événement comptable DOIT être déclaré ici avant toute implémentation

---

## NOMENCLATURE

| Code | Format | Exemple |
|------|--------|---------|
| FAC-xxx | Facturation | FAC-001 Facture émise |
| PAI-xxx | Paie / RH | PAI-001 Bulletin généré |
| SAN-xxx | Santé / Clinique | SAN-001 Consultation |
| RES-xxx | Restaurant / POS | RES-001 Vente POS |
| ECO-xxx | École / Scolarité | ECO-001 Inscription |
| COM-xxx | Commerce / Stock | COM-001 Vente |
| TRP-xxx | Transport | TRP-001 Course |
| HOT-xxx | Hôtel | HOT-001 Réservation |
| FIS-xxx | Fiscalité | FIS-001 Déclaration TVA |
| TRE-xxx | Trésorerie | TRE-001 Dépôt banque |
| MOB-xxx | Mobile Money | MOB-001 Réception |
| ONG-xxx | ONG / Associations | ONG-001 Don reçu |
| AGR-xxx | Agriculture | AGR-001 Récolte |
| ASS-xxx | Assurance | ASS-001 Prime reçue |
| BTP-xxx | BTP / Chantier | BTP-001 Avancement |
| CAB-xxx | Cabinet / Honoraires | CAB-001 Prestation facturée |

---

## MODULE FACTURATION

---

### FAC-001 — Facture Émise

| Champ | Valeur |
|-------|--------|
| **Module** | Facturation |
| **Déclencheur** | `UPDATE factures SET statut='envoyee'` ou `INSERT factures` avec statut initial `'envoyee'` |
| **Implémentation actuelle** | Trigger `trg_facture_issued` → `fn_facture_issued_to_journal()` + Route `POST /api/factures` |
| **Tables source** | `factures` |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 411 Clients | 706 Prestations de services | HT | `Facture FAC-XXX — Client — HT` | factures_emises |
| 2 | 411 Clients | 4441 État TVA facturée | TVA | `Facture FAC-XXX — Client — TVA` | factures_tva |
| 3 | 411 Clients | 447 État — retenues à la source (CA 5%) | CA 5% | `Facture FAC-XXX — Client — CA 5%` | factures_emises |

#### Impacts

| Dimension | Impact |
|-----------|--------|
| **TVA** | Collectée — crédit 4441. Déclarée dans TVA mensuelle du mois d'émission |
| **Trésorerie** | AUCUN — accrual (créance enregistrée, encaissement en attente) |
| **Fiscal** | CA imposable augmente. Base IS. CA 5% prélevé à la source |
| **Dashboards** | Balance clients (411), Chiffre d'affaires, Factures en attente |
| **États financiers** | Bilan actif (Clients 411), Compte de résultat (Produits 706) |

#### Règles métier
- Ne pas générer si `statut = 'brouillon'`
- Ne pas générer si `type = 'avoir'` (→ FAC-005)
- Vérifier idempotence : `source='factures_emises' AND source_id=facture.id` ne doit exister qu'une fois
- Si `tva_montant = 0` : pas d'écriture 411/4441
- Si `ca_montant = 0` ou pays sans CA : pas d'écriture 411/447
- Montant HT = `total - tva_montant - ca_montant`

#### Validations obligatoires
- `facture.total > 0`
- `facture.client_id` non null
- `facture.tenant_id` valide
- `facture.invoice_number` ou `facture.id` disponible pour libellé

---

### FAC-002 — Facture Payée (Règlement total)

| Champ | Valeur |
|-------|--------|
| **Module** | Facturation |
| **Déclencheur** | `UPDATE factures SET statut='payee'` |
| **Implémentation actuelle** | Trigger `trg_facture_paid` → `fn_facture_paid_to_journal()` |
| **Tables source** | `factures`, `paiements_factures` |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 521/571/5711/512 Trésorerie | 411 Clients | Total TTC | `Règlement facture FAC-XXX` | factures_paiement |

#### Impacts

| Dimension | Impact |
|-----------|--------|
| **TVA** | AUCUN (TVA déjà comptabilisée à l'émission — FAC-001) |
| **Trésorerie** | ENTRÉE — débite le compte de trésorerie selon mode_paiement |
| **Fiscal** | AUCUN additionnel |
| **Dashboards** | Trésorerie, Balance clients (apure 411), Encaissements |
| **États financiers** | Bilan trésorerie (521/571), Bilan actif clients (diminue) |

#### Règles métier
- Le compte trésorerie dépend de `mode_paiement` : virement→521, espèces→571, mobile→5711/5712, chèque→512
- Vérifier que FAC-001 a bien été généré avant (sinon créer accrual)
- Idempotence : `source='factures_paiement' AND source_id=facture.id` une seule fois
- Créer aussi une ligne dans `transactions` (type=entree)

#### Validations obligatoires
- `facture.statut` était `'envoyee'` ou `'partielle'`
- `mode_paiement` connu et valide
- Montant payé = `facture.total`

---

### FAC-003 — Paiement Partiel

| Champ | Valeur |
|-------|--------|
| **Module** | Facturation |
| **Déclencheur** | INSERT dans `paiements_factures` avec montant < total facture |
| **Implémentation actuelle** | NON IMPLÉMENTÉ en journal_entries — à créer Phase 4 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 521/571 Trésorerie | 411 Clients | Montant partiel | `Acompte facture FAC-XXX` | factures_acompte |

#### Règles métier
- Ne pas solder le compte 411 (la créance reste ouverte pour le reliquat)
- `factures.statut` → `'partielle'`
- Cumuler les paiements partiels jusqu'au solde total
- Au dernier paiement → FAC-002

---

### FAC-004 — Annulation Facture

| Champ | Valeur |
|-------|--------|
| **Module** | Facturation |
| **Déclencheur** | `UPDATE factures SET statut='annulee'` |
| **Implémentation actuelle** | NON IMPLÉMENTÉ en journal_entries — à créer Phase 4 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 706 Prestations | 411 Clients | HT | `Annulation facture FAC-XXX` | factures_annulation |
| 2 | 4441 TVA facturée | 411 Clients | TVA | `Annulation TVA FAC-XXX` | factures_annulation |

#### Règles métier
- Extourne (contre-passation) des écritures de FAC-001
- Interdit si facture déjà payée (statut='payee')
- Générer uniquement si FAC-001 avait été comptabilisé

---

### FAC-005 — Avoir (Note de crédit)

| Champ | Valeur |
|-------|--------|
| **Module** | Facturation |
| **Déclencheur** | INSERT facture avec `type='avoir'` |
| **Implémentation actuelle** | Exclu de fn_facture_issued_to_journal — à créer Phase 4 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 706 Prestations | 411 Clients | HT | `Avoir AVO-XXX — Client` | factures_avoir |
| 2 | 4441 TVA facturée | 411 Clients | TVA | `Avoir TVA AVO-XXX` | factures_avoir |

---

### FAC-006 — Remise Accordée

| Champ | Valeur |
|-------|--------|
| **Module** | Facturation |
| **Déclencheur** | `facture.remise > 0` au moment de l'émission |
| **Implémentation actuelle** | Absorbé dans le HT net — pas d'écriture séparée |

#### Règles métier
- La remise diminue la base HT → comptabilisée nette
- Si remise > seuil significatif (ex: >10%), documenter dans libellé

---

## MODULE RH / PAIE

---

### PAI-001 — Bulletin Généré (Accrual)

| Champ | Valeur |
|-------|--------|
| **Module** | RH / Paie |
| **Déclencheur** | `INSERT bulletins_paie` — statut initial `'generee'` |
| **Implémentation actuelle** | T9 `fn_bulletins_paie_to_journal()` — migration 136 — BLOC VALIDATION |
| **Tables source** | `bulletins_paie` |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 661 Rémunérations versées | 421 Personnel — rémunérations dues | Salaire brut | `Paie [MOIS/ANNEE] — [Employé]` | paie_accrual |
| 2 | 664 Charges sociales patronales | 431 Sécurité sociale (CNSS patronal) | CNSS patronal | `CNSS patronal [MOIS] — [Employé]` | paie_cnss |
| 3 | 421 Personnel — rémunérations dues | 431 Sécurité sociale (CNSS salariale) | CNSS salarié | `CNSS salariale [MOIS] — [Employé]` | paie_cnss_sal |
| 4 | 421 Personnel — rémunérations dues | 447 État — IRPP retenu | IRPP | `IRPP [MOIS] — [Employé]` | paie_irpp |

#### Impacts

| Dimension | Impact |
|-----------|--------|
| **TVA** | AUCUN |
| **Trésorerie** | AUCUN à ce stade (dette enregistrée, pas encore décaissée) |
| **Fiscal** | Charges déductibles IS (661, 664). Base CNSS. Base IRPP |
| **Dashboards** | Masse salariale, Charges sociales, IRPP collecté |
| **États financiers** | Compte de résultat (Charges 661/664), Bilan passif (421 dette personnel) |

#### Règles métier
- Idempotence : `source='paie_accrual' AND source_id=bulletin.id` une seule fois
- CNSS salariale retenue sur le brut (plafond selon pays)
- IRPP calculé sur brut - CNSS salariale - abattements
- Ne PAS créer si T9 a déjà traité ce bulletin (vérification existante)

---

### PAI-002 — Bulletin Validé / Payé

| Champ | Valeur |
|-------|--------|
| **Module** | RH / Paie |
| **Déclencheur** | `UPDATE bulletins_paie SET statut='paye'` |
| **Implémentation actuelle** | T9 — BLOC PAIEMENT |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 421 Personnel — rémunérations dues | 521/571/5711/5712 Trésorerie | Net à payer | `Paiement paie [MOIS] — [Employé]` | paie_paiement |

#### Impacts

| Dimension | Impact |
|-----------|--------|
| **TVA** | AUCUN |
| **Trésorerie** | SORTIE — débite le compte selon mode_paiement |
| **Fiscal** | Soldé comptablement |
| **Dashboards** | Trésorerie (décaissement), Paie dashboard |
| **États financiers** | Bilan trésorerie (diminue), Bilan passif 421 (soldé) |

---

### PAI-003 — Avance sur Salaire

| Champ | Valeur |
|-------|--------|
| **Module** | RH / Paie |
| **Déclencheur** | INSERT dans `rh_acomptes` |
| **Implémentation actuelle** | Route `/api/rh/acomptes` — INSERT journal_comptable + journal_entries |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 421 Personnel — rémunérations dues | 521 Banque | Montant avance | `Avance salaire — [Employé] — [Mois]` | acomptes |

#### Règles métier
- L'avance vient en déduction du net à payer du mois
- Vérifier que l'avance ≤ net prévisible
- Traçabilité : source_id = acompte.id

---

### PAI-004 — Prime Exceptionnelle

| Champ | Valeur |
|-------|--------|
| **Module** | RH / Paie |
| **Déclencheur** | Incluse dans le bulletin (champ `primes`) ou événement séparé |
| **Implémentation actuelle** | Absorbée dans le brut du bulletin (PAI-001) |

#### Règles métier
- Si prime > seuil, documenter séparément dans libellé
- Base CNSS et IRPP selon règles pays

---

### PAI-005 — Retenue (disciplinaire, absence)

| Champ | Valeur |
|-------|--------|
| **Module** | RH / Paie |
| **Déclencheur** | Champ `retenues` dans bulletins_paie |
| **Implémentation actuelle** | Déduite du brut — absorbée dans PAI-001 |

---

### PAI-006 — Congés Payés (Provision)

| Champ | Valeur |
|-------|--------|
| **Module** | RH / Paie |
| **Déclencheur** | Calcul mensuel automatique ou clôture d'exercice |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 663 Indemnités et avantages divers | 429 Personnel — autres dettes | Provision mensuelle CP | `Provision congés payés [MOIS] — [Dept]` |

---

## MODULE SANTÉ / CLINIQUE

---

### SAN-001 — Consultation (Paiement immédiat)

| Champ | Valeur |
|-------|--------|
| **Module** | Santé / Clinique |
| **Déclencheur** | `POST /api/sante/consultations` avec `statut_paiement='paye'` et `montant > 0` |
| **Implémentation actuelle** | INSERT transactions uniquement — MANQUE journal_entries (AN-014) |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 521/571 Trésorerie | 706 Prestations de services médicales | Montant | `Consultation — [Patient] — [Date]` | sante_consultation |

#### Règles métier
- Si `statut_paiement='en_attente'` → enregistrement accrual en 411/706 (créance patient)
- Si `montant = 0` → consultation gratuite, pas d'écriture
- TVA généralement exonérée pour actes médicaux (vérifier par pays)

---

### SAN-002 — Facture Clinique (his_factures)

| Champ | Valeur |
|-------|--------|
| **Module** | Santé / Clinique |
| **Déclencheur** | `UPDATE his_factures SET statut='payee'` |
| **Implémentation actuelle** | Trigger `trg_his_facture_journal` → `fn_his_facture_journal()` — migration 131 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 521/571 Trésorerie | 706 Soins et prestations | montant_paye | `Règlement his_factures [ID]` | sante_facture |

---

### SAN-003 — Hospitalisation / Acte Médical

| Champ | Valeur |
|-------|--------|
| **Module** | Santé / Clinique |
| **Déclencheur** | INSERT acte médical ou hospitalisation avec facturation |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 411 Patients ou 521 Tréso | 706 Prestations médicales | Montant acte | `Hospitalisation — [Patient]` |

---

### SAN-004 — Vente Pharmacie / Médicaments

| Champ | Valeur |
|-------|--------|
| **Module** | Santé / Pharmacie |
| **Déclencheur** | Vente au comptoir pharmacie |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 571 Caisse | 701 Ventes de marchandises | HT | `Vente pharmacie — [Ref]` |
| 2 | 571 Caisse | 4441 TVA | TVA (si applicable) | `TVA pharmacie` |
| 3 | 601 Achats marchandises | 310 Stock | Coût | `Sortie stock médicaments` |

---

### SAN-005 — Paiement Assurance Maladie

| Champ | Valeur |
|-------|--------|
| **Module** | Santé / Assurance |
| **Déclencheur** | Réception remboursement assurance |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 521 Banque | 411 Patients (ou 413 Assureurs) | Remboursement | `Remboursement assurance — [Dossier]` |

---

## MODULE RESTAURANT / POS

---

### RES-001 — Vente POS (Caisse)

| Champ | Valeur |
|-------|--------|
| **Module** | Restaurant / POS |
| **Déclencheur** | `POST /api/resto/commandes` ou ticket de caisse validé |
| **Implémentation actuelle** | INSERT transactions uniquement — MANQUE journal_entries |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 571 Caisse | 701 Ventes de restauration | HT | `Vente POS — [Ticket]` | resto_vente |
| 2 | 571 Caisse | 4441 TVA | TVA | `TVA restauration` | resto_tva |
| 3 | 601 Achats consommés | 310 Stock | Coût matières | `Consommation stock — [Ticket]` | resto_stock |

---

### RES-002 — Achat Fournisseur Restaurant

| Champ | Valeur |
|-------|--------|
| **Module** | Restaurant |
| **Déclencheur** | `POST /api/resto/achats` |
| **Implémentation actuelle** | INSERT transactions (sortie) uniquement — MANQUE journal_entries |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 601 Achats de marchandises / matières | 401 Fournisseurs | TTC | `Achat — [Fournisseur] — [Ref]` |
| 2 | 4446 TVA déductible | 401 Fournisseurs | TVA déductible | `TVA achat fournisseur` |

---

### RES-003 — Annulation Commande

| Champ | Valeur |
|-------|--------|
| **Module** | Restaurant |
| **Déclencheur** | Annulation ticket avant encaissement |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Règles métier
- Si déjà encaissé → remboursement → extourne de RES-001
- Si non encaissé → pas d'écriture (jamais comptabilisé)

---

### RES-004 — Clôture Caisse

| Champ | Valeur |
|-------|--------|
| **Module** | Restaurant |
| **Déclencheur** | `POST /api/agents/restaurant/cloture` |
| **Implémentation actuelle** | INSERT transactions (clôture) |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 521 Banque (dépôt) | 571 Caisse | Montant versé | `Clôture caisse — [Date]` |

---

## MODULE ÉCOLE / SCOLARITÉ

---

### ECO-001 — Paiement Scolarité

| Champ | Valeur |
|-------|--------|
| **Module** | École / Scolarité |
| **Déclencheur** | INSERT `paiements_scolaires` |
| **Implémentation actuelle** | Trigger `trg_paiement_scolaire` → transactions + journal_comptable (page.tsx) |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 521/571/5711 Trésorerie | 706 Prestations d'enseignement | Montant | `Scolarité — [Élève] — [Période]` | paiement_scolaire |

---

### ECO-002 — Inscription / Réinscription

| Champ | Valeur |
|-------|--------|
| **Module** | École |
| **Déclencheur** | INSERT `inscriptions` avec frais d'inscription > 0 |
| **Implémentation actuelle** | NON IMPLÉMENTÉ en journal_entries — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 521/571 Trésorerie | 706 Frais d'inscription | Montant | `Inscription — [Élève] — [Année]` |

---

### ECO-003 — Paiement Transport Scolaire

| Champ | Valeur |
|-------|--------|
| **Module** | École |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 521/571 Trésorerie | 706 Services transport | Montant | `Transport scolaire — [Élève]` |

---

### ECO-004 — Paiement Cantine

| Champ | Valeur |
|-------|--------|
| **Module** | École |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

---

### ECO-005 — Wallet École (Mobile Money Scolaire)

| Champ | Valeur |
|-------|--------|
| **Module** | École |
| **Déclencheur** | INSERT `ecole_wallet_movements` |
| **Implémentation actuelle** | Trigger `trg_wallet_movement_journal` — migration 031 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 5711/5712 Mobile Money | 706 Scolarité | Recharge | `Recharge wallet — [Élève]` |
| 2 | 651 Frais financiers | 5711/5712 Mobile Money | Frais opérateur | `Frais wallet — [Opérateur]` |

---

## MODULE COMMERCE / STOCK

---

### COM-001 — Vente Commerce

| Champ | Valeur |
|-------|--------|
| **Module** | Commerce |
| **Implémentation actuelle** | Transactions partielles — à compléter Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 521/571 Trésorerie | 701 Ventes de marchandises | HT | `Vente — [Article] — [Date]` |
| 2 | 521/571 Trésorerie | 4441 TVA collectée | TVA | `TVA vente` |
| 3 | 601 Coût des ventes | 310 Stock | Coût | `Sortie stock — [Article]` |

---

### COM-002 — Achat Stock / Approvisionnement

| Champ | Valeur |
|-------|--------|
| **Module** | Commerce / Stock |
| **Déclencheur** | INSERT `achats` ou `stock_mouvements` (type=entree) |
| **Implémentation actuelle** | Trigger `fn_achat_enregistrement` (migration 046) — 310/401 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 310 Stock de marchandises | 401 Fournisseurs | TTC HT | `Achat — [Fournisseur] — [Réf]` | achats_enregistrement |
| 2 | 4446 TVA déductible | 401 Fournisseurs | TVA | `TVA achat` | achats_tva |

---

### COM-003 — Retour Client

| Champ | Valeur |
|-------|--------|
| **Module** | Commerce |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES (extourne de COM-001)

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 701 Ventes | 411 Clients / 521 Tréso | HT | `Retour — [Référence]` |
| 2 | 310 Stock | 601 Coût des ventes | Coût | `Retour stock — [Article]` |

---

### COM-004 — Inventaire / Régularisation Stock

| Champ | Valeur |
|-------|--------|
| **Module** | Commerce / Stock |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 394 Pertes sur stocks | 310 Stock | Ecart négatif | `Inventaire — perte stock` |
| 2 | 310 Stock | 394 Gains sur stocks | Ecart positif | `Inventaire — excédent stock` |

---

## MODULE TRANSPORT

---

### TRP-001 — Course / Prestation Transport

| Champ | Valeur |
|-------|--------|
| **Module** | Transport |
| **Implémentation actuelle** | INSERT transactions (carburant/course) — MANQUE journal_entries |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 521/5711 Trésorerie | 706 Prestations transport | HT | `Course — [Réf] — [Date]` |
| 2 | 6241 Carburant | 521/571 Trésorerie | Coût carburant | `Carburant — [Véhicule]` |

---

### TRP-002 — Paiement Chauffeur / Commission

| Champ | Valeur |
|-------|--------|
| **Module** | Transport |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 661 Rémunérations / 631 Commission | 421/521 Personnel / Tréso | Commission | `Commission chauffeur — [Réf]` |

---

### TRP-003 — Reversement Chauffeur

| Champ | Valeur |
|-------|--------|
| **Module** | Transport |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

---

## MODULE HÔTEL

---

### HOT-001 — Réservation (Acompte reçu)

| Champ | Valeur |
|-------|--------|
| **Module** | Hôtel |
| **Implémentation actuelle** | Tables créées (mig 052, 082) — comptabilité NON IMPLÉMENTÉE |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 521/571 Trésorerie | 419 Clients — avances reçues | Acompte | `Acompte réservation — [Chambre] — [Client]` |

---

### HOT-002 — Check-in

| Champ | Valeur |
|-------|--------|
| **Module** | Hôtel |
| **Implémentation actuelle** | NON IMPLÉMENTÉ |

#### Règles métier
- Pas d'écriture au check-in (sauf si premier paiement)
- La créance client (411) est ouverte à partir du check-in

---

### HOT-003 — Check-out / Facturation Séjour

| Champ | Valeur |
|-------|--------|
| **Module** | Hôtel |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 411 Clients | 706 Hébergement | HT nuits | `Séjour — [Client] — [Chambre]` |
| 2 | 411 Clients | 4441 TVA | TVA | `TVA hébergement` |
| 3 | 419 Avances | 411 Clients | Acompte versé | `Imputation acompte réservation` |

---

### HOT-004 — Paiement Hôtel

| Champ | Valeur |
|-------|--------|
| **Module** | Hôtel |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 521/571/5711 Trésorerie | 411 Clients | Solde | `Règlement séjour — [Client]` |

---

## MODULE FISCALITÉ

---

### FIS-001 — Déclaration TVA (Mensuelle)

| Champ | Valeur |
|-------|--------|
| **Module** | Fiscalité |
| **Déclencheur** | `UPDATE tva_declarations SET statut='validee'` |
| **Implémentation actuelle** | Trigger `fn_tva_declaration_to_journal()` — migration 046, réécrit migration 137 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 4441 TVA facturée | 444 TVA à décaisser | TVA collectée nette | `TVA [MM/AAAA] — solde TVA` | tva_declaration |

---

### FIS-002 — Paiement TVA (DGI)

| Champ | Valeur |
|-------|--------|
| **Module** | Fiscalité |
| **Déclencheur** | `UPDATE tva_declarations SET statut='payee'` |
| **Implémentation actuelle** | Trigger `fn_tva_declaration_to_journal()` — bloc paiement |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 444 TVA à décaisser | 521 Banque | Montant DGI | `TVA [MM/AAAA] — paiement DGI` | tva_paiement |

---

### FIS-003 — Déclaration IS / Acompte IS

| Champ | Valeur |
|-------|--------|
| **Module** | Fiscalité |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 891 IS | 441 État — IS à payer | IS calculé | `IS [EXERCICE] — provision` |
| 2 | 441 État — IS à payer | 521 Banque | IS payé | `IS [EXERCICE] — paiement DGI` |

---

### FIS-004 — Paiement CNSS / IRPP (Organisme)

| Champ | Valeur |
|-------|--------|
| **Module** | Fiscalité / RH |
| **Déclencheur** | Virement mensuel CNSS + IRPP aux organismes |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 431 CNSS | 521 Banque | Total CNSS | `Reversement CNSS — [Mois]` |
| 2 | 447 IRPP | 521 Banque | Total IRPP | `Reversement IRPP — [Mois]` |

---

## MODULE TRÉSORERIE

---

### TRE-001 — Dépôt Bancaire

| Champ | Valeur |
|-------|--------|
| **Module** | Trésorerie |
| **Déclencheur** | `INSERT caisse_operations` (type=depot_banque) |
| **Implémentation actuelle** | Trigger `fn_caisse_operation_to_journal()` — migration 046 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 521 Banque | 571 Caisse | Montant | `Dépôt banque — [Date]` | caisse_operations |

---

### TRE-002 — Retrait Bancaire

| Champ | Valeur |
|-------|--------|
| **Module** | Trésorerie |
| **Implémentation actuelle** | Trigger `fn_caisse_operation_to_journal()` |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 571 Caisse | 521 Banque | Montant | `Retrait banque — [Date]` |

---

### TRE-003 — Virement Bancaire Sortant (Fournisseur)

| Champ | Valeur |
|-------|--------|
| **Module** | Trésorerie |
| **Déclencheur** | `UPDATE virements SET statut='execute'` |
| **Implémentation actuelle** | Trigger `fn_virement_to_journal()` — migration 046 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 401 Fournisseurs | 521 Banque | Montant virement | `Virement — [Bénéficiaire]` | virements |

---

### TRE-004 — Chèque Reçu / Émis / Encaissé

| Champ | Valeur |
|-------|--------|
| **Module** | Trésorerie |
| **Déclencheur** | INSERT/UPDATE `cheques` |
| **Implémentation actuelle** | Trigger `fn_cheque_to_journal()` — migration 046 |

#### Écritures SYSCOHADA

| Scénario | Débit | Crédit | Source |
|----------|-------|--------|--------|
| Chèque reçu | 512 Chèques à encaisser | 411 Clients | cheques_recu |
| Chèque émis | 401 Fournisseurs | 521 Banque | cheques_emis |
| Encaissement | 521 Banque | 512 Chèques à encaisser | cheques_encaissement |

---

### TRE-005 — Transfert Inter-Comptes

| Champ | Valeur |
|-------|--------|
| **Module** | Trésorerie |
| **Déclencheur** | `UPDATE transfers SET statut='execute'` |
| **Implémentation actuelle** | Trigger `fn_transfer_to_journal()` — migration 046, réécrit migration 137 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | Compte destination | Compte source | Montant | `Transfert — [Source] → [Destination]` | transfers |
| 2 | 661 Frais financiers | Compte source | Frais | `Frais transfert` | transfers_frais |

---

## MODULE MOBILE MONEY

---

### MOB-001 — Réception Mobile Money

| Champ | Valeur |
|-------|--------|
| **Module** | Mobile Money |
| **Déclencheur** | INSERT `mobile_wallet_operations` (type=entree) |
| **Implémentation actuelle** | Trigger `fn_mobile_wallet_operation_to_journal()` — réécrit migration 137 |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 5711/5712 Mobile Money | 411 Clients | Montant reçu | `Mobile Money reçu — [Opérateur]` | mobile_wallet |
| 2 | 661 Charges financières | 5711/5712 Mobile Money | Frais | `Frais opérateur — [Opérateur]` | mobile_wallet_frais |

---

### MOB-002 — Envoi Mobile Money

| Champ | Valeur |
|-------|--------|
| **Module** | Mobile Money |
| **Implémentation actuelle** | Trigger `fn_mobile_wallet_operation_to_journal()` (type=sortie) |

#### Écritures SYSCOHADA

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 658 Charges diverses | 5711/5712 Mobile Money | Montant | `Mobile Money envoyé — [Opérateur]` |

---

### MOB-003 — Rechargement Wallet / Approvisionnement

| Champ | Valeur |
|-------|--------|
| **Module** | Mobile Money |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 5711/5712 Mobile Money | 521 Banque | Montant rechargé | `Rechargement wallet [Opérateur]` |

---

## MODULE ONG / ASSOCIATIONS

---

### ONG-001 — Don Reçu

| Champ | Valeur |
|-------|--------|
| **Module** | ONG |
| **Déclencheur** | `POST /api/ong/dons` |
| **Implémentation actuelle** | INSERT transactions (entree) — MANQUE journal_entries |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé | Source |
|---|-------|--------|---------|---------|--------|
| 1 | 521/571 Trésorerie | 754 Subventions et dons | Montant | `Don reçu — [Donateur]` | ong_dons |

---

### ONG-002 — Subvention Reçue

| Champ | Valeur |
|-------|--------|
| **Module** | ONG |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

#### Écritures SYSCOHADA CIBLES

| # | Débit | Crédit | Montant | Libellé |
|---|-------|--------|---------|---------|
| 1 | 521 Banque | 141 Subventions d'investissement | Montant | `Subvention — [Bailleur] — [Projet]` |

---

### ONG-003 — Dépense Projet

| Champ | Valeur |
|-------|--------|
| **Module** | ONG |
| **Implémentation actuelle** | NON IMPLÉMENTÉ — à créer Phase 4 |

---

## MODULES NON ENCORE CONNECTÉS (Phase 4+)

### Agriculture, BTP, Assurance, Mines, Cabinet

Ces modules disposent de tables en base mais aucun trigger comptable n'est implémenté.

| Module | Événements à créer |
|--------|--------------------|
| **Agriculture** | Récolte, Vente récolte, Achat intrants, Charge main d'oeuvre |
| **BTP** | Avancement chantier, Situation travaux, Paiement sous-traitant, Réception |
| **Assurance** | Prime reçue, Sinistre payé, Provision sinistre, Réassurance |
| **Mines** | Extraction, Vente minerai, Redevance minière, Charge exploitation |
| **Cabinet** | Honoraires facturés, Honoraires reçus, Frais de dossier |

---

## RÉSUMÉ — 52 ÉVÉNEMENTS CATALOGUÉS

| Module | Événements | Implémentés | À créer |
|--------|-----------|-------------|---------|
| Facturation | 6 | 3 (FAC-001/002 trigger + route) | 3 (FAC-003/004/005) |
| RH/Paie | 6 | 3 (PAI-001/002/003) | 3 (PAI-004/005/006) |
| Santé | 5 | 2 (SAN-001 partiel, SAN-002) | 3 |
| Restaurant | 4 | 1 (transactions seules) | 3 |
| École | 5 | 2 (ECO-001/005) | 3 |
| Commerce/Stock | 4 | 2 (COM-002 trigger) | 2 |
| Transport | 3 | 0 | 3 |
| Hôtel | 4 | 0 | 4 |
| Fiscalité | 4 | 2 (FIS-001/002) | 2 |
| Trésorerie | 5 | 5 (TRE-001 à 005 via triggers) | 0 |
| Mobile Money | 3 | 2 (MOB-001/002 via trigger) | 1 |
| ONG | 3 | 0 | 3 |
| Agriculture/BTP/Assurance/Mines/Cabinet | 15+ | 0 | 15+ |
| **TOTAL** | **67+** | **22** | **45+** |
