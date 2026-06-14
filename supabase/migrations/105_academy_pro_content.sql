-- ============================================================
-- Migration 105 — MIAA Academy Pro : Contenu pédagogique
-- Leçons, questions, badges, parcours métiers
-- ============================================================

-- ── 1. BADGES ────────────────────────────────────────────────────────────────
INSERT INTO academy_badges (code, nom, description, icone, couleur, condition) VALUES
('premier_pas',      'Premier Pas',        'Vous avez suivi votre premier cours',                    '🌱', '#16A34A', '{"type":"cours_count","valeur":1}'),
('explorateur',      'Explorateur',        '5 domaines explorés',                                    '🧭', '#2563EB', '{"type":"domaines_count","valeur":5}'),
('quiz_champion',    'Quiz Champion',      'Quiz réussi avec 100% dans un domaine',                  '⚡', '#7C3AED', '{"type":"quiz_perfect","valeur":1}'),
('trio_certifie',    'Trio Certifié',      '3 certificats obtenus',                                  '🏅', '#F59E0B', '{"type":"certificat_count","valeur":3}'),
('ohada_master',     'OHADA Master',       'Certificat Comptabilité OHADA obtenu',                   '📒', '#2563EB', '{"type":"certificat_domaine","domaine":"comptabilite-ohada"}'),
('fiscal_expert',    'Expert Fiscal',      'Certificat Fiscalité Congo obtenu',                      '🏛️', '#7C3AED', '{"type":"certificat_domaine","domaine":"fiscalite"}'),
('rh_pro',           'RH Professionnel',   'Certificat RH & Paie obtenu',                            '👥', '#16A34A', '{"type":"certificat_domaine","domaine":"rh-paie"}'),
('assidu',           'Assidu',             '7 jours consécutifs de formation',                       '🔥', '#DC2626', '{"type":"streak","valeur":7}'),
('auditeur',         'Auditeur Certifié',  'Certificat Audit & Contrôle Interne obtenu',             '🔍', '#DC2626', '{"type":"certificat_domaine","domaine":"audit"}'),
('polyvalent',       'Polyvalent',         '10 domaines différents explorés',                        '🌟', '#F59E0B', '{"type":"domaines_count","valeur":10}'),
('dirige_general',   'Dirigeant Confirmé', 'Parcours Direction Générale complété',                   '🎯', '#0F172A', '{"type":"parcours","code":"direction-generale"}'),
('expert_finance',   'Expert Finance',     'Certificats Finance + Trésorerie obtenus',               '💹', '#0891B2', '{"type":"multi_certificat","domaines":["finance","tresorerie"]}')
ON CONFLICT (code) DO NOTHING;

-- ── 2. PARCOURS MÉTIERS ───────────────────────────────────────────────────────
INSERT INTO academy_parcours (code, titre, description, metier, icone, couleur, domaines, duree_totale_h, niveau_min) VALUES
('comptable-junior',
 'Comptable Junior OHADA',
 'Parcours complet pour maîtriser la comptabilité SYSCOHADA, la fiscalité congolaise et les déclarations obligatoires.',
 'Comptable', '📒', '#2563EB',
 ARRAY['comptabilite-ohada','fiscalite','tresorerie','cabinet-comptable'],
 40, 'debutant'),

('drh-rh',
 'Directeur RH & Paie',
 'Formation complète gestion des ressources humaines, paie CNSS, droit du travail Congo et recrutement.',
 'DRH', '👥', '#16A34A',
 ARRAY['rh-paie','management','leadership'],
 30, 'debutant'),

('auditeur-controle',
 'Auditeur Interne Certifié',
 'Maîtriser l''audit OHADA, le contrôle interne COSO, la détection de fraudes et la rédaction de rapports.',
 'Auditeur', '🔍', '#DC2626',
 ARRAY['audit','comptabilite-ohada','fiscalite','controle-gestion'],
 35, 'intermediaire'),

('direction-generale',
 'Direction Générale & Stratégie',
 'Parcours dirigeant : finance, contrôle de gestion, management, CRM, conformité OHADA.',
 'Directeur Général', '🎯', '#0F172A',
 ARRAY['controle-gestion','finance','tresorerie','management','leadership','crm-vente'],
 50, 'avance'),

('entrepreneur-congo',
 'Entrepreneur Congo',
 'Créer et gérer son entreprise au Congo : SARL, obligations légales, gestion, financement.',
 'Entrepreneur', '🚀', '#EA580C',
 ARRAY['entrepreneuriat','comptabilite-ohada','fiscalite','crm-vente','management'],
 25, 'debutant')
ON CONFLICT (code) DO NOTHING;

-- ── 3. LEÇONS ─────────────────────────────────────────────────────────────────
-- Format : (domaine, niveau, sequence, titre, objectifs, content_md, duree_min, tags)

INSERT INTO academy_lessons (domaine, niveau, sequence, titre, objectifs, content_md, duree_min, tags) VALUES

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPTABILITÉ OHADA
-- ═══════════════════════════════════════════════════════════════════════════════
('comptabilite-ohada','debutant',1,
 'Introduction au SYSCOHADA Révisé 2017',
 ARRAY['Comprendre les 9 classes de comptes SYSCOHADA','Maîtriser la règle Débit = Crédit','Identifier les documents comptables obligatoires'],
 E'# Introduction au SYSCOHADA Révisé 2017\n\n## Qu''est-ce que le SYSCOHADA ?\n\nLe **Système Comptable OHADA** (SYSCOHADA) est le référentiel comptable obligatoire dans les 17 pays membres de l''OHADA, dont le Congo-Brazzaville. La version révisée de 2017 intègre les normes IFRS pour les grandes entreprises.\n\n## Les 9 Classes de Comptes\n\n| Classe | Intitulé | Exemples |\n|--------|----------|----------|\n| **1** | Capitaux | Capital social (101), Emprunts (16) |\n| **2** | Immobilisations | Terrain (22), Matériel (24), Amortissements (28) |\n| **3** | Stocks | Marchandises (31), Matières premières (32) |\n| **4** | Tiers | Clients (41), Fournisseurs (40), État (44) |\n| **5** | Trésorerie | Banque (52), Caisse (57), Mobile Money (58) |\n| **6** | Charges | Achats (60), Salaires (66), Amortissements (68) |\n| **7** | Produits | Ventes (70), Autres produits (75) |\n| **8** | HAO | Charges HAO (81), Produits HAO (82) |\n| **9** | Analytique | Comptes de gestion analytique |\n\n## La Règle Fondamentale : Débit = Crédit\n\nChaque opération est enregistrée **en partie double** :\n- Ce que j''acquiers → au **Débit**\n- Ce que je donne en échange → au **Crédit**\n\n**Exemple** : Achat d''ordinateur 500 000 FCFA payé par banque\n```\nDébit 24 (Matériel)  500 000\n   Crédit 52 (Banque)     500 000\n```\n\n## Documents Comptables Obligatoires\n\n1. **Journal** — enregistrement chronologique de toutes les opérations\n2. **Grand Livre** — regroupement par compte\n3. **Balance** — vérification Débit = Crédit\n4. **Bilan** — situation patrimoniale au 31/12\n5. **Compte de résultat** — performance sur l''exercice\n\n> **Conseil pratique** : Au Congo-Brazzaville, l''exercice comptable va du 1er janvier au 31 décembre. Les états financiers doivent être déposés à la DGI dans les 3 mois suivant la clôture.',
 25, ARRAY['syscohada','bases','journal','comptes']),

('comptabilite-ohada','debutant',2,
 'TVA Congo : Collecte, Déduction et Déclaration',
 ARRAY['Calculer la TVA 18% + Centime Additionnel 5%','Enregistrer la TVA collectée et déductible','Préparer la déclaration trimestrielle'],
 E'# TVA Congo-Brazzaville\n\n## Le Taux de TVA au Congo\n\nAu Congo, la TVA se décompose en deux parties :\n- **TVA** : 18% du prix HT\n- **Centime Additionnel (CA)** : 5% de la TVA\n\n**Calcul du TTC** :\n```\nTVA = Prix HT × 18%\nCA  = TVA × 5%\nTTC = HT + TVA + CA\nTTC = HT × 1,189\n```\n\n**Exemple** : Facture HT = 1 000 000 FCFA\n```\nTVA = 1 000 000 × 18% = 180 000 FCFA\nCA  = 180 000 × 5%    =   9 000 FCFA\nTTC = 1 189 000 FCFA\n```\n\n## Enregistrement Comptable\n\n### Vente TTC 1 189 000 FCFA\n```\nDébit  41 (Clients)      1 189 000\n   Crédit 70 (Ventes)         1 000 000\n   Crédit 4431 (TVA collectée)  180 000\n   Crédit 4434 (CA collecté)      9 000\n```\n\n### Achat TTC 595 000 FCFA (HT = 500 000)\n```\nDébit  60 (Achats)         500 000\nDébit  4451 (TVA déductible) 90 000\nDébit  4454 (CA déductible)   4 500\n   Crédit 40 (Fournisseurs)    594 500\n```\n\n## Déclaration Trimestrielle\n\nLa TVA se déclare **tous les trimestres** à la DGI :\n- TVA à reverser = TVA collectée − TVA déductible\n- Formulaire CERFA-DGI à déposer avant le 20 du mois suivant le trimestre\n\n> **Attention** : Le CA n''est pas récupérable sur les achats pour les petites entreprises soumises au régime simplifié.',
 30, ARRAY['tva','centime-additionnel','declaration','dgi']),

('comptabilite-ohada','intermediaire',1,
 'Clôture des Comptes et États Financiers OHADA',
 ARRAY['Effectuer les opérations de clôture','Établir le bilan et le compte de résultat','Calculer les amortissements linéaires'],
 E'# Clôture des Comptes et États Financiers OHADA\n\n## Opérations de Fin d''Exercice\n\n### 1. Amortissements\nFormule linéaire SYSCOHADA :\n```\nDotation annuelle = (Valeur d''acquisition − Valeur résiduelle) / Durée d''utilisation\n```\nExemple : Véhicule 8 000 000 FCFA, 5 ans, valeur résiduelle 0\n```\nDotation = 8 000 000 / 5 = 1 600 000 FCFA/an\n\nDébit 681 (Dotations amortissements)  1 600 000\n   Crédit 284 (Amortissements matériel)  1 600 000\n```\n\n### 2. Provisions\n- Provision créances douteuses : client qui ne paie pas depuis 6 mois\n- Provision pour dépréciation de stocks\n\n### 3. Régularisation des charges et produits\n- Charges à payer (CAP) : charges de décembre non encore facturées\n- Produits à recevoir (PAR) : revenus de décembre non encore facturés\n\n## Structure du Bilan SYSCOHADA\n\n**ACTIF** (ce que l''entreprise possède)\n- Actif immobilisé : terrains, bâtiments, matériel, immo incorporelles\n- Actif circulant : stocks, clients, trésorerie\n\n**PASSIF** (ce que l''entreprise doit)\n- Capitaux propres : capital, réserves, résultat\n- Dettes financières : emprunts\n- Dettes d''exploitation : fournisseurs, État\n\n## Compte de Résultat\n\n```\nRésultat = Produits − Charges\n\nProduits d''exploitation (cl.7) : Ventes, prestations\nCharges d''exploitation (cl.6)  : Achats, salaires, amortissements\n\nRésultat d''exploitation = Produits 70-75 − Charges 60-69\nRésultat financier       = Produits 77 − Charges 67\nRésultat HAO             = Produits 82 − Charges 81\nRésultat net             = Total après IS 30%\n```',
 35, ARRAY['cloture','bilan','compte-resultat','amortissements']),

('comptabilite-ohada','avance',1,
 'Consolidation et Comptes de Groupe OHADA',
 ARRAY['Maîtriser les méthodes de consolidation','Éliminer les opérations intragroupe','Calculer les écarts d''acquisition'],
 E'# Consolidation des Comptes de Groupe OHADA\n\n## Méthodes de Consolidation\n\n| Méthode | Conditions | Traitement |\n|---------|-----------|------------|\n| **Intégration globale** | Contrôle exclusif (>50%) | 100% des actifs/passifs |\n| **Intégration proportionnelle** | Contrôle conjoint | % de détention |\n| **Mise en équivalence** | Influence notable (20-50%) | Quote-part du résultat |\n\n## Étapes de Consolidation\n\n1. **Retraitement** des comptes individuels aux normes du groupe\n2. **Cumul** ligne par ligne des bilans et comptes de résultat\n3. **Élimination** des opérations intragroupe\n   - Ventes intragroupe\n   - Dividendes internes\n   - Créances/dettes réciproques\n4. **Partage** des capitaux propres\n   - Part du groupe vs part des minoritaires\n\n## Écart d''Acquisition (Goodwill)\n```\nGoodwill = Prix d''acquisition − Quote-part des actifs nets identifiables\n```\n> Au Congo, le goodwill est amorti sur 5 à 20 ans selon le principe de prudence SYSCOHADA.',
 40, ARRAY['consolidation','groupe','goodwill','ifrs']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- FISCALITÉ CONGO
-- ═══════════════════════════════════════════════════════════════════════════════
('fiscalite','debutant',1,
 'Les Impôts au Congo : IS, TVA, IRPP, Patente',
 ARRAY['Identifier les principaux impôts congolais','Calculer l''IS 30% sur le bénéfice','Distinguer les régimes fiscaux'],
 E'# Les Impôts au Congo-Brazzaville\n\n## Impôt sur les Sociétés (IS)\n\n**Taux** : 30% du bénéfice imposable\n\n**Base de calcul** :\n```\nBénéfice imposable = Résultat comptable\n                   + Réintégrations (charges non déductibles)\n                   − Déductions autorisées\n```\n\n**Charges non déductibles** :\n- Amendes et pénalités\n- Impôts sur les bénéfices eux-mêmes\n- Intérêts excessifs aux associés\n\n## IRPP (Impôt sur le Revenu des Personnes Physiques)\n\nBarème progressif 2024 :\n| Tranche (FCFA/an) | Taux |\n|-------------------|------|\n| 0 — 464 000 | 0% |\n| 464 001 — 1 000 000 | 5% |\n| 1 000 001 — 3 000 000 | 10% |\n| 3 000 001 — 8 000 000 | 25% |\n| > 8 000 000 | 40% |\n\n## Patente\n\nTaxe professionnelle annuelle basée sur le chiffre d''affaires et la valeur locative. Minimum : **72 100 FCFA** pour les micro-entreprises.\n\n## Régimes Fiscaux\n\n| Régime | CA annuel | Obligations |\n|--------|-----------|-------------|\n| **Micro** | < 30M FCFA | Forfait simplifié |\n| **Réel simplifié** | 30M — 500M | Bilan simplifié, TVA trimestrielle |\n| **Réel normal** | > 500M | Bilan complet, TVA mensuelle |\n\n> **NIU** = Numéro d''Identification Unique — obligatoire pour toute entreprise au Congo. A obtenir à la DGI dans les 30 jours de création.',
 30, ARRAY['is','irpp','patente','niu','dgi']),

('fiscalite','debutant',2,
 'Déclarations Fiscales Obligatoires au Congo',
 ARRAY['Connaître le calendrier fiscal','Préparer la déclaration TVA','Éviter les pénalités de retard'],
 E'# Déclarations Fiscales Obligatoires au Congo\n\n## Calendrier Fiscal 2024\n\n| Impôt | Fréquence | Délai |\n|-------|-----------|-------|\n| TVA | Trimestrielle | 20 du mois suivant le trimestre |\n| Retenues à la source (IRPP salaires) | Mensuelle | 20 du mois suivant |\n| Acomptes IS | Mensuelle | 20 du mois |\n| Déclaration IS | Annuelle | 31 mars de l''exercice suivant |\n| Patente | Annuelle | 31 janvier |\n| DAS (Déclaration des Achats et Services) | Annuelle | 31 mars |\n\n## DAS — Déclaration des Achats et Services\n\nObligation annuelle de déclarer tous les achats et services supérieurs à **100 000 FCFA** par fournisseur. But : croiser les données pour détecter les fraudes.\n\n## Pénalités de Retard\n\n- Retard déclaration TVA : 25% des droits + 1% par mois\n- Non-paiement IS : 30% + intérêts de retard\n- Défaut de DAS : amende de 500 000 FCFA minimum\n\n## Contrôle Fiscal\n\nEn cas de contrôle DGI :\n1. Droit à l''assistance d''un expert-comptable\n2. Délai de 10 jours pour répondre à la notification\n3. Possibilité de négocier une transaction fiscale\n4. Recours hiérarchique puis tribunal administratif\n\n> **Conseil** : Conservez TOUS vos justificatifs pendant 10 ans (délai de prescription fiscale au Congo).',
 25, ARRAY['declarations','tva','das','penalites','controle-fiscal']),

('fiscalite','intermediaire',1,
 'Optimisation Fiscale Légale en OHADA',
 ARRAY['Identifier les niches fiscales légales','Optimiser la structure du salaire','Utiliser les amortissements accélérés'],
 E'# Optimisation Fiscale Légale OHADA — Congo\n\n## Charges Déductibles à Optimiser\n\n### 1. Amortissements Accélérés\nPour certains équipements de production :\n- Coefficient dégressif 1,25 à 2,0 selon la durée\n- Réduit la base IS les premières années\n\n### 2. Frais Généraux\nDéductibles si justifiés par l''exploitation :\n- Loyer bureau (même domicile si usage professionnel documenté)\n- Téléphone et internet professionnels\n- Formation des salariés\n- Frais de représentation (dans la limite du raisonnable)\n\n### 3. Provisions Déductibles\n- Provisions pour créances douteuses (clients en litige)\n- Provisions pour dépréciation de stocks\n- Provisions pour congés non pris\n\n## Optimisation des Rémunérations\n\n```\nRémunération nette optimale :\n- Salaire de base (soumis IRPP + CNSS)\n- + Avantages en nature évalués forfaitairement\n- + Notes de frais remboursées sur justificatifs (exonérées)\n- + Intéressement (exonéré jusqu''à 15% du salaire)\n```\n\n## Crédit de TVA et Remboursement\n\nQuand la TVA déductible > TVA collectée, vous avez un **crédit de TVA** :\n- Imputable sur les trimestres suivants\n- Remboursable sous conditions (exportateurs principalement)\n- À déclarer et justifier auprès de la DGI\n\n> **Important** : L''optimisation fiscale EST légale. L''évasion fiscale EST illégale. La frontière : la réalité économique de l''opération.',
 35, ARRAY['optimisation','deductions','provisions','avantages-nature']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUDIT & CONTRÔLE INTERNE
-- ═══════════════════════════════════════════════════════════════════════════════
('audit','debutant',1,
 'Introduction à l''Audit Interne OHADA',
 ARRAY['Comprendre la mission de l''audit interne','Distinguer audit interne et audit externe','Connaître le référentiel COSO'],
 E'# Introduction à l''Audit Interne OHADA\n\n## Définition et Mission\n\nL''**audit interne** est une activité indépendante d''assurance et de conseil qui :\n- Évalue les risques\n- Contrôle les processus\n- Améliore les opérations de l''organisation\n\n## Audit Interne vs Audit Externe\n\n| Critère | Audit Interne | Audit Externe (CAC) |\n|---------|--------------|--------------------|\n| **Qui** | Salarié de l''entreprise | Commissaire aux comptes indépendant |\n| **Pour qui** | Direction générale | Actionnaires, tiers |\n| **Mission** | Améliorer les processus | Certifier les comptes |\n| **Fréquence** | Continue | Annuelle |\n| **Obligation** | Recommandée | Obligatoire SA > seuils |\n\n## Le Référentiel COSO\n\nLe **Committee of Sponsoring Organizations** définit 5 composantes du contrôle interne :\n\n1. **Environnement de contrôle** : culture éthique, compétences, organisation\n2. **Évaluation des risques** : identification et analyse des risques\n3. **Activités de contrôle** : procédures, autorisations, ségrégation des tâches\n4. **Information et communication** : systèmes d''information fiables\n5. **Pilotage** : surveillance continue et évaluations ponctuelles\n\n## Grille de Scoring des Risques\n\n```\nScore de risque = Probabilité × Impact\n\nProbabilité : 1 (rare) à 5 (quasi-certain)\nImpact      : 1 (négligeable) à 5 (catastrophique)\n\nScore 1-4   : Risque faible — surveiller\nScore 5-9   : Risque moyen — contrôler\nScore 10-15 : Risque élevé — action prioritaire\nScore 16-25 : Risque critique — action immédiate\n```',
 30, ARRAY['audit','coso','risques','controle-interne']),

('audit','intermediaire',1,
 'Conduite d''une Mission d''Audit Interne',
 ARRAY['Planifier une mission d''audit','Conduire les tests de conformité','Rédiger un rapport d''audit professionnel'],
 E'# Conduite d''une Mission d''Audit Interne\n\n## Les 4 Phases d''une Mission\n\n### Phase 1 : Planification (20% du temps)\n- Lettre de mission signée par la direction\n- Prise de connaissance du domaine audité\n- Identification des risques préliminaires\n- Programme de travail détaillé\n\n### Phase 2 : Réalisation (50% du temps)\n**Tests de conformité** : vérifier que les procédures existent et sont respectées\n```\nExemple : Audit du processus achats\n□ Bon de commande signé par responsable autorisé ?\n□ Trois devis comparatifs pour achats > 500 000 FCFA ?\n□ Réception matérialisée (bon de réception signé) ?\n□ Rapprochement facture / bon de commande / bon de réception ?\n□ Règlement validé par direction financière ?\n```\n\n**Tests de substance** : vérifier les montants et soldes\n- Circularisation des créanciers/débiteurs\n- Inventaire physique de stocks\n- Sondages statistiques\n\n### Phase 3 : Communication (20% du temps)\nStructure du rapport d''audit :\n1. Synthèse exécutive (1 page)\n2. Constatations et recommandations\n3. Plan d''action convenu avec l''audité\n4. Annexes et pièces justificatives\n\n### Phase 4 : Suivi (10% du temps)\n- Vérification de la mise en œuvre des recommandations\n- Rapport de suivi à 3 et 6 mois\n\n## Grille d''Évaluation Finale\n\n| Score | Niveau | Signification |\n|-------|--------|---------------|\n| 85-100 | ✅ Satisfaisant | Contrôles efficaces |\n| 70-84 | ⚠️ Perfectible | Quelques lacunes |\n| 50-69 | 🟠 Insuffisant | Actions requises |\n| <50 | 🔴 Critique | Plan d''urgence |\n',
 40, ARRAY['mission-audit','tests','rapport','plan-action']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- RH & PAIE
-- ═══════════════════════════════════════════════════════════════════════════════
('rh-paie','debutant',1,
 'Calculer un Bulletin de Paie au Congo',
 ARRAY['Calculer les cotisations CNSS salarié et patronal','Appliquer le barème IRPP','Obtenir le salaire net à payer'],
 E'# Calcul du Bulletin de Paie — Congo-Brazzaville\n\n## Les Cotisations Obligatoires\n\n### CNSS (Caisse Nationale de Sécurité Sociale)\n\n| Cotisation | Taux | Assiette | Plafond |\n|-----------|------|----------|--------|\n| Salarié | 5,04% | Salaire brut | 1 500 000 FCFA/mois |\n| Patronal | 14,36% | Salaire brut | 1 500 000 FCFA/mois |\n| Médecine travail | 0,50% | Salaire brut | Aucun |\n| Accidents travail | 3 à 5% | Salaire brut | Selon secteur |\n\n### IRPP (calcul mensuel)\n```\nRevenu imposable = Salaire brut − CNSS salarié − Autres déductions légales\nIRPP mensuel = Appliquer le barème annuel / 12\n```\n\n## Exemple Complet\n\n**Salarié** : Comptable junior, salaire brut 350 000 FCFA/mois\n\n```\nSalaire brut                        350 000\n− CNSS salarié (5,04%)              − 17 640\n─────────────────────────────────────────────\nRevenu imposable                    332 360\n\nIRPP annualisé : 332 360 × 12 = 3 988 320\n  Tranche 0-464 000 : 0%         →       0\n  Tranche 464 001-1 000 000 : 5% →  26 800\n  Tranche 1 000 001-3 000 000 : 10% → 199 832\n  Tranche 3 000 001-3 988 320 : 25% → 247 080\nIRPP annuel total                   473 712\nIRPP mensuel (÷12)                   39 476\n\nSalaire NET = 350 000 − 17 640 − 39 476 = 292 884 FCFA\n\nCoût total employeur = 350 000 + CNSS patronal (14,36%) + Médecine travail (0,5%)\n                     = 350 000 + 50 260 + 1 750 = 402 010 FCFA\n```\n\n## Les Documents à Remettre\n1. **Bulletin de paie** (obligatoire, à conserver 5 ans)\n2. **Déclaration mensuelle CNSS** (avant le 20 du mois suivant)\n3. **Déclaration IRPP mensuel** à la DGI',
 35, ARRAY['paie','cnss','irpp','bulletin-salaire']),

('rh-paie','debutant',2,
 'Contrats de Travail au Congo — CDI, CDD et Clauses',
 ARRAY['Distinguer CDI et CDD','Connaître les clauses obligatoires','Appliquer les règles de licenciement'],
 E'# Contrats de Travail au Congo-Brazzaville\n\n## CDI vs CDD\n\n| Critère | CDI | CDD |\n|---------|-----|-----|\n| **Durée** | Indéterminée | Déterminée (max 2 ans) |\n| **Renouvellement** | Sans limite | 1 renouvellement maximum |\n| **Période d''essai** | 3 mois (cadre : 6 mois) | Proportionnelle à la durée |\n| **Fin de contrat** | Préavis ou licenciement | Terme du contrat |\n\n## Clauses Obligatoires\n\nTout contrat écrit doit mentionner :\n1. Identité des parties\n2. Date de début et durée (pour CDD)\n3. Lieu de travail\n4. **Poste et qualification**\n5. **Rémunération brute** et avantages\n6. Durée du travail\n7. Référence à la convention collective applicable\n8. Période d''essai\n\n## SMIG Congo\n\nLe **Salaire Minimum Interprofessionnel Garanti** est fixé par décret. Aucun salaire ne peut être inférieur au SMIG, même en période d''essai.\n\n## Licenciement — Procédure Légale\n\n1. **Convocation** à un entretien préalable (lettre recommandée, délai 5 jours ouvrables)\n2. **Entretien préalable** (l''employé peut se faire assister)\n3. **Lettre de licenciement** (motif précis obligatoire, 5 jours après entretien)\n4. **Préavis** :\n   - Ouvrier : 15 jours\n   - Employé : 1 mois\n   - Cadre : 3 mois\n5. **Indemnité de licenciement** (si +1 an ancienneté) :\n   - 25% du salaire mensuel moyen × nombre d''années\n\n> **Faute grave** : dispense de préavis et d''indemnité — mais doit être prouvée.',
 25, ARRAY['cdi','cdd','licenciement','smig','contrat-travail']),

('rh-paie','intermediaire',1,
 'CNSS Congo — Déclarations et Contrôles',
 ARRAY['Établir la déclaration mensuelle CNSS','Gérer un contrôle CNSS','Calculer les indemnités CNSS'],
 E'# CNSS Congo — Déclarations et Gestion\n\n## Déclaration Mensuelle CNSS\n\nÀ déposer **avant le 20 de chaque mois** pour le mois précédent.\n\n### Contenu de la déclaration\n- Liste nominative de tous les salariés\n- Salaire brut individuel\n- Cotisations salarié et patronal\n- Total à verser\n\n### Plafond de cotisation\n```\nPlafond CNSS = 1 500 000 FCFA/mois\n→ Pour un salaire > 1 500 000 FCFA, les cotisations sont calculées sur 1 500 000\n\nExemple : DG, salaire brut = 3 000 000 FCFA\nCNSS salarié = 1 500 000 × 5,04% = 75 600 FCFA (et non 151 200)\n```\n\n## Prestations CNSS\n\n| Prestation | Conditions | Montant |\n|-----------|-----------|--------|\n| **Maladie** | 6 mois de cotisation | 2/3 du salaire journalier |\n| **Maternité** | 9 mois de cotisation | 100% du salaire, 14 semaines |\n| **Accident de travail** | Immédiat | Selon taux d''incapacité |\n| **Retraite** | 60 ans + 20 ans cotisations | % du salaire moyen |\n| **Invalidité** | Taux d''incapacité > 66% | % de la pension |\n\n## Contrôle CNSS — Comment se Préparer\n\n**Documents à tenir à disposition** :\n- Registre du personnel (à jour)\n- Contrats de travail de tous les salariés\n- Bulletins de paie des 3 dernières années\n- Déclarations CNSS et justificatifs de paiement\n- Relevés bancaires\n\n**Redressement CNSS** : si des salariés ne sont pas déclarés, pénalité = cotisations dues × 3 + intérêts',
 35, ARRAY['cnss','declaration','controle','prestations']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- FINANCE
-- ═══════════════════════════════════════════════════════════════════════════════
('finance','debutant',1,
 'Analyse Financière : Lecture du Bilan et du Compte de Résultat',
 ARRAY['Lire un bilan SYSCOHADA','Calculer les principaux ratios financiers','Interpréter les résultats'],
 E'# Analyse Financière Fondamentale\n\n## Lecture du Bilan SYSCOHADA\n\n### Structure de l''Actif\n```\nACTIF IMMOBILISÉ (long terme)\n  + Immobilisations incorporelles (logiciels, brevets)\n  + Immobilisations corporelles (terrains, bâtiments, matériel)\n  + Immobilisations financières (participations)\n─────────────────────────────────────────────\nACTIF CIRCULANT (court terme)\n  + Stocks et en-cours\n  + Créances clients\n  + Disponibilités (banque + caisse + mobile money)\n```\n\n## Ratios Fondamentaux\n\n### Liquidité\n```\nLiquidité générale   = Actif CT / Passif CT         → Idéal > 1,5\nLiquidité réduite    = (Actif CT − Stocks) / Passif CT → Idéal > 1\nLiquidité immédiate  = Disponibilités / Passif CT   → Idéal > 0,3\n```\n\n### Rentabilité\n```\nROE = Résultat net / Capitaux propres × 100  → Idéal > 10%\nROA = Résultat net / Total actif × 100       → Idéal > 5%\nMarge nette = Résultat net / CA × 100\n```\n\n### Endettement\n```\nGearing = Dettes financières / Capitaux propres → Idéal < 1\nCouverture dettes = EBITDA / Dettes financières  → Idéal > 2\n```\n\n## Exemple d''Analyse\n\nBilan simplifié : Actif CT 50M, Passif CT 30M, Stocks 15M\n```\nLiquidité générale = 50 / 30 = 1,67 ✅\nLiquidité réduite  = (50-15) / 30 = 1,17 ✅\n→ Situation de liquidité SATISFAISANTE\n```',
 30, ARRAY['bilan','ratios','liquidite','rentabilite']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTRÔLE DE GESTION
-- ═══════════════════════════════════════════════════════════════════════════════
('controle-gestion','debutant',1,
 'Tableaux de Bord et KPIs — Construire son Pilotage',
 ARRAY['Définir les KPIs pertinents pour son activité','Construire un tableau de bord mensuel','Analyser les écarts budget/réel'],
 E'# Tableaux de Bord et KPIs en Contrôle de Gestion\n\n## Qu''est-ce qu''un KPI ?\n\nUn **Key Performance Indicator** (indicateur clé de performance) mesure l''atteinte d''un objectif. Un bon KPI est :\n- **Mesurable** : exprimable en chiffre\n- **Atteignable** : réaliste\n- **Temporel** : avec une fréquence de suivi\n- **Actionnable** : sur lequel on peut agir\n\n## KPIs Universels par Type d''Entreprise\n\n### Commerce / Distribution\n```\n□ CA mensuel (et vs objectif)\n□ Marge brute (%)\n□ Rotation des stocks (jours)\n□ Délai de règlement clients (jours)\n□ Taux de retour marchandises\n```\n\n### Services\n```\n□ Taux d''utilisation (heures facturées / heures disponibles)\n□ CA par prestataire\n□ Délai moyen de facturation\n□ Taux de satisfaction client\n```\n\n### Production / BTP\n```\n□ Taux d''utilisation des équipements\n□ Coût de revient unitaire vs standard\n□ Taux de non-conformité\n□ Délai moyen de livraison\n```\n\n## Structure d''un Tableau de Bord Mensuel\n\n| Indicateur | Objectif | Réel | Écart | Tendance |\n|-----------|---------|------|-------|----------|\n| CA (MFCFA) | 50 | 47 | −6% | ↓ |\n| Marge brute | 35% | 33% | −2pts | → |\n| Charges fixes | 15 M | 14 M | +6% ✅ | → |\n\n## Analyse des Écarts\n```\nÉcart global CA = CA réel − CA prévu\nÉcart prix     = (Prix réel − Prix prévu) × Quantités réelles\nÉcart volume   = (Qté réelles − Qté prévues) × Prix prévu\n```',
 30, ARRAY['kpi','tableau-de-bord','budget','ecarts']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRÉSORERIE & BFR
-- ═══════════════════════════════════════════════════════════════════════════════
('tresorerie','debutant',1,
 'BFR, FRNG et Trésorerie — Les 3 Équilibres Financiers',
 ARRAY['Calculer le Fonds de Roulement Net Global (FRNG)','Calculer le Besoin en Fonds de Roulement (BFR)','Interpréter la Trésorerie nette'],
 E'# Les 3 Équilibres Financiers Fondamentaux\n\n## 1. Fonds de Roulement Net Global (FRNG)\n\nLe FRNG mesure l''excédent des ressources stables sur les emplois stables :\n\n```\nFRNG = Ressources stables − Emplois stables\n     = (Capitaux propres + Dettes LT) − Actif immobilisé net\n```\n\nUn **FRNG positif** signifie que l''entreprise finance ses actifs longs avec des ressources longues. ✅\nUn **FRNG négatif** est un signal d''alerte grave. 🔴\n\n## 2. Besoin en Fonds de Roulement (BFR)\n\n```\nBFR = (Stocks + Créances clients) − Dettes fournisseurs\n```\n\nLe BFR représente le besoin de financement lié au cycle d''exploitation.\n\n**Délais utiles** :\n```\nDélai clients      = (Créances clients × 360) / CA TTC\nDélai fournisseurs = (Dettes fournisseurs × 360) / Achats TTC\nRotation stocks    = (Stocks × 360) / CA HT\n```\n\n## 3. Trésorerie Nette\n\n```\nTrésorerie nette = FRNG − BFR\n```\n\n**Interprétation** :\n- Trésorerie > 0 ✅ : Situation saine\n- Trésorerie < 0 🔴 : Découvert bancaire nécessaire\n\n## Exemple Congo\n\nEntreprise commerce Brazzaville :\n```\nFRNG = 20 000 000 − 12 000 000 = 8 000 000\nBFR  = (5 000 000 + 8 000 000) − 6 000 000 = 7 000 000\nTrésorerie = 8 000 000 − 7 000 000 = 1 000 000 FCFA ✅\n```\n\n> **Attention Mobile Money** : Les soldes MTN/Airtel/Orange doivent être intégrés dans la trésorerie. Au Congo, certaines entreprises ont plus de liquidité sur mobile money que sur compte bancaire !',
 25, ARRAY['frng','bfr','tresorerie','liquidite']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════════
('management','debutant',1,
 'Management par Objectifs (MBO) et SMART',
 ARRAY['Définir des objectifs SMART','Déléguer efficacement','Conduire un entretien d''évaluation'],
 E'# Management par Objectifs — MBO\n\n## La Méthode SMART\n\nTout objectif doit être :\n- **S**pécifique : concret, pas vague\n- **M**esurable : avec un indicateur chiffré\n- **A**tteignable : réaliste avec les ressources disponibles\n- **R**elevant (pertinent) : aligné sur la stratégie\n- **T**emporel : avec une date limite\n\n**Exemple** :\n❌ "Augmenter les ventes"\n✅ "Augmenter le CA de 15% d''ici le 31 décembre 2024 en développant 3 nouveaux clients grands comptes"\n\n## Délégation Efficace\n\nLes 5 niveaux de délégation :\n1. "Faites exactement ceci" (aucune autonomie)\n2. "Proposez et je décide"\n3. "Décidez et informez-moi"\n4. "Décidez librement dans ce cadre"\n5. "Gérez complètement" (délégation totale)\n\n**Règle d''or** : Déléguer les tâches, pas les responsabilités. Le manager reste responsable du résultat.\n\n## Entretien d''Évaluation Annuel\n\nStructure recommandée (90 minutes) :\n1. **Bilan** de l''année écoulée (30 min)\n   - Objectifs atteints / non atteints\n   - Compétences démontrées\n2. **Points forts et axes d''amélioration** (20 min)\n3. **Objectifs N+1** (25 min) — 3 à 5 objectifs SMART\n4. **Plan de développement** (15 min) — formations, évolution\n\n> **Contexte Congo** : L''entretien d''évaluation n''est pas obligatoire légalement mais est fortement recommandé par les meilleures pratiques RH pour justifier les promotions et évolutions salariales.',
 25, ARRAY['mbo','smart','delegation','evaluation']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- GESTION DE STOCK
-- ═══════════════════════════════════════════════════════════════════════════════
('gestion-stock','debutant',1,
 'Méthodes de Gestion des Stocks : FIFO, FEFO, ABC',
 ARRAY['Appliquer FIFO et FEFO','Faire une analyse ABC','Calculer le stock de sécurité'],
 E'# Gestion des Stocks — Méthodes Fondamentales\n\n## FIFO — First In, First Out\n\nLes premiers articles entrés sont les premiers sortis.\n- Adapté aux biens qui ne périssent pas\n- Valorisation au coût historique\n- Recommandé par SYSCOHADA OHADA\n\n**Exemple** :\n```\nEntrée 01/01 : 100 unités à 1 000 FCFA\nEntrée 15/01 : 50 unités à 1 100 FCFA\nSortie 20/01 : 80 unités\n→ 80 unités sorties à 1 000 FCFA (les premières entrées)\n```\n\n## FEFO — First Expired, First Out\n\nLes produits dont la **date d''expiration est la plus proche** sortent en premier.\n- **Obligatoire** pour : médicaments, aliments, produits cosmétiques\n- Prévient les pertes sur produits périmés\n\n## Analyse ABC — Pareto des Stocks\n\n| Catégorie | % Articles | % Valeur | Action |\n|-----------|-----------|----------|--------|\n| **A** | 20% | 80% | Contrôle permanent, stock sécurité bas |\n| **B** | 30% | 15% | Contrôle mensuel |\n| **C** | 50% | 5% | Commande groupée, peu de suivi |\n\n## Stock de Sécurité (SS)\n\nProtège contre les ruptures :\n```\nSS = Consommation journalière × Délai de livraison supplémentaire\n\nExemple : On consomme 50 unités/jour, délai fournisseur = 7 jours\nSS = 50 × 7 = 350 unités\n\nPoint de commande = (Consommation × Délai normal) + SS\n```\n\n> **Inventaire OHADA** : L''inventaire physique annuel est obligatoire. Il doit correspondre à l''inventaire comptable. Tout écart doit être expliqué et enregistré.',
 25, ARRAY['fifo','fefo','abc','stock-securite','inventaire']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- CRM & VENTE
-- ═══════════════════════════════════════════════════════════════════════════════
('crm-vente','debutant',1,
 'Pipeline Commercial et Scoring des Leads',
 ARRAY['Structurer un pipeline commercial','Qualifier les leads','Calculer le taux de conversion'],
 E'# Pipeline Commercial et CRM\n\n## Le Pipeline Commercial\n\nUn pipeline est la représentation de l''avancement de vos prospects :\n\n```\n📥 LEADS          → Contacts entrants (email, appel, réseaux)\n       ↓\n🔍 QUALIFICATION  → Est-ce une vraie opportunité ?\n       ↓\n💼 PROPOSITION    → Devis/offre envoyée\n       ↓\n🤝 NÉGOCIATION    → Discussion des conditions\n       ↓\n✅ CLÔTURE        → Bon de commande signé\n       ↓\n🔄 FIDÉLISATION   → Suivi post-vente, upsell\n```\n\n## Scoring des Leads (méthode BANT)\n\nQualifier chaque prospect selon 4 critères :\n- **B**udget : A-t-il le budget pour acheter ?\n- **A**uthority : Est-il décideur ?\n- **N**eed : A-t-il un vrai besoin ?\n- **T**imeline : Dans quel délai ?\n\nScore : 0-25 (à abandonner), 26-50 (à nourrir), 51-75 (à prioriser), 76-100 (à clore immédiatement)\n\n## KPIs Commerciaux Essentiels\n\n```\nTaux de conversion = Clients signés / Prospects qualifiés × 100\nDurée du cycle de vente = Délai moyen lead → signature\nCA moyen par client = CA total / Nombre de clients\nLTV (Life Time Value) = CA moyen × Durée moyenne relation\nCoût d''acquisition = Budget commercial / Nouveaux clients\n```\n\n> **Contexte Congo** : La vente B2B au Congo repose beaucoup sur la confiance personnelle et les réseaux. Le bouche-à-oreille et les recommandations restent les meilleurs canaux. WhatsApp Business est indispensable.',
 25, ARRAY['pipeline','leads','crm','taux-conversion']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENTREPRENEURIAT
-- ═══════════════════════════════════════════════════════════════════════════════
('entrepreneuriat','debutant',1,
 'Créer sa SARL au Congo — Étapes et Coûts',
 ARRAY['Connaître les étapes de création d''une SARL','Calculer les coûts de création','Obtenir le RCCM et le NIU'],
 E'# Créer une SARL au Congo-Brazzaville\n\n## Pourquoi une SARL ?\n\nLa **Société À Responsabilité Limitée** est la forme juridique la plus choisie par les entrepreneurs congolais :\n- Capital minimum : **100 000 FCFA** (un seul associé possible : SARL unipersonnelle)\n- Responsabilité limitée aux apports\n- Structure souple et crédible\n\n## Étapes de Création\n\n**1. Rédaction des statuts** (notaire ou sous seing privé)\n- Objet social, siège, capital, gérance, durée\n- Coût notaire : 50 000 — 150 000 FCFA\n\n**2. Dépôt du capital** en banque\n- Attestation de dépôt de capital\n- Délai : 1-2 jours ouvrables\n\n**3. RCCM** — Registre du Commerce\n- Guichet Unique de Formalisation des Entreprises (GUFE)\n- Délai : 3-5 jours\n- Coût : environ 30 000 — 50 000 FCFA\n\n**4. NIU** — Numéro d''Identification Unique\n- DGI (Direction Générale des Impôts)\n- Délai : 24-48h\n- Gratuit\n\n**5. Immatriculation CNSS** (si salariés)\n- Délai : 5 jours\n\n## Coût Total Estimé\n\n```\nNotaire (statuts)           : 50 000 − 150 000 FCFA\nRCCM + formalités GUFE     : 30 000 − 80 000 FCFA\nCapital minimum (récupérable): 100 000 FCFA\nDivers (traductions, copies) :  20 000 − 30 000 FCFA\n─────────────────────────────────────────────────\nTOTAL estimé               : 200 000 − 360 000 FCFA\n```\n\n> **OHADA** : Depuis 2010, les 17 pays membres de l''OHADA ont un droit des sociétés unifié (Acte Uniforme sur les Sociétés). Les mêmes règles s''appliquent au Congo, au Cameroun, au Sénégal, etc.',
 25, ARRAY['sarl','rccm','niu','creation-entreprise','ohada']),

-- ═══════════════════════════════════════════════════════════════════════════════
-- BANQUE & MICROFINANCE
-- ═══════════════════════════════════════════════════════════════════════════════
('banque-microfinance','debutant',1,
 'Microfinance et Microcrédit au Congo — COBAC et Réglementation',
 ARRAY['Comprendre la réglementation COBAC','Distinguer IMF et banque','Calculer un microcrédit'],
 E'# Microfinance au Congo — Cadre Réglementaire\n\n## La COBAC\n\nLa **Commission Bancaire de l''Afrique Centrale** (COBAC) supervise les banques et institutions de microfinance dans la zone CEMAC (Congo, Cameroun, Gabon, Centrafrique, Tchad, Guinée Équatoriale).\n\n**Rôle de la COBAC** :\n- Délivrer les agréments aux IMF\n- Contrôler le respect des ratios prudentiels\n- Surveiller la lutte anti-blanchiment (LAB/FT)\n\n## Types d''Institutions\n\n| Type | Activités autorisées | Capital minimum |\n|------|---------------------|------------------|\n| **IMF Catégorie 1** | Épargne membres uniquement | 25M FCFA |\n| **IMF Catégorie 2** | Épargne + crédit membres | 50M FCFA |\n| **IMF Catégorie 3** | Épargne et crédit tous publics | 300M FCFA |\n| **Banque** | Toutes opérations | 10 milliards FCFA |\n\n## Calcul d''un Microcrédit\n\n**Méthode de la dégressivité** (plus courante) :\n```\nEmprunt : 500 000 FCFA\nTaux    : 2% par mois\nDurée   : 6 mois\n\nMois 1 : Intérêts = 500 000 × 2% = 10 000\n          Remboursement capital = 83 333\n          Total mensualité 1 = 93 333\n\nMois 2 : Capital restant = 416 667\n          Intérêts = 416 667 × 2% = 8 333\n          Total mensualité 2 = 91 666\n...\n```\n\n## KYC — Know Your Customer\n\nObligatoire avant tout octroi de crédit :\n- Pièce d''identité valide\n- Justificatif de revenus ou d''activité\n- Références personnelles (2 garants)\n- Plan d''affaires pour prêts > 500 000 FCFA',
 30, ARRAY['cobac','microfinance','microcredit','kyc','cemac'])

ON CONFLICT (domaine, niveau, sequence) DO NOTHING;

-- ── 4. QUESTIONS PAR DOMAINE ──────────────────────────────────────────────────
-- (Questions organisées par domaine et niveau, au-delà des 7 domaines existants)

INSERT INTO academy_questions (domaine, niveau, question, options, answer_idx, explication, points) VALUES

-- COMPTABILITÉ OHADA — Débutant
('comptabilite-ohada','debutant','Le SYSCOHADA révisé comporte combien de classes de comptes ?','["7","8","9","10"]',2,'Le SYSCOHADA révisé 2017 comporte 9 classes de comptes, de la classe 1 (Capitaux) à la classe 9 (Analytique).',1),
('comptabilite-ohada','debutant','La règle fondamentale de la comptabilité en partie double est :','["Actif = Passif","Débit = Crédit","Produits = Charges","Capital = Résultat"]',1,'En comptabilité en partie double, chaque opération est enregistrée au débit et au crédit pour un montant égal.',1),
('comptabilite-ohada','debutant','Le compte 411 correspond à :','["Fournisseurs","Clients","Banque","Caisse"]',1,'Le compte 41 est la classe des Clients. Le compte 411 = Clients ordinaires.',1),
('comptabilite-ohada','debutant','La TVA au Congo est de :','["15%","18%","20%","25%"]',1,'Le taux standard de TVA au Congo-Brazzaville est de 18% du prix hors taxes.',1),
('comptabilite-ohada','debutant','Le Centime Additionnel (CA) est de :','["5% du HT","5% de la TVA","18% du TTC","2% du HT"]',1,'Le CA = 5% de la TVA. Sur une TVA de 180 000 FCFA, le CA = 9 000 FCFA.',1),
('comptabilite-ohada','debutant','Le compte de la Caisse en SYSCOHADA est le :','["51","52","57","58"]',2,'Le compte 57 = Caisse (espèces). Le 52 = Banque, le 51 = Virements internes.',1),
('comptabilite-ohada','debutant','L''exercice comptable standard au Congo commence le :','["1er juillet","1er octobre","1er janvier","1er avril"]',2,'L''exercice comptable au Congo correspond à l''année civile : du 1er janvier au 31 décembre.',1),
('comptabilite-ohada','debutant','Pour un achat de marchandises payé en espèces, on débite :','["Caisse","Fournisseurs","Achats de marchandises","Clients"]',2,'On débite le compte 601 (Achats de marchandises) car c''est ce qu''on acquiert. On crédite la Caisse car on sort de l''argent.',1),
('comptabilite-ohada','debutant','Le compte 101 représente :','["Réserves","Capital social","Résultat de l''exercice","Emprunts"]',1,'Le compte 101 = Capital social — la mise de départ des associés dans l''entreprise.',1),
('comptabilite-ohada','debutant','La balance vérifie que :','["Total Débit = Total Crédit","Actif = Capitaux propres","CA > Charges","Stocks = Ventes"]',0,'La balance des comptes vérifie l''équilibre Total Débit = Total Crédit pour toutes les écritures passées.',1),

-- COMPTABILITÉ OHADA — Intermédiaire
('comptabilite-ohada','intermediaire','La dotation aux amortissements est enregistrée au crédit du compte :','["683","28x","68x","24x"]',1,'La dotation aux amortissements débite le 681/683 (charge) et crédite un compte 28x (amortissements cumulés).',1),
('comptabilite-ohada','intermediaire','Le FRNG (Fonds de Roulement Net Global) se calcule par :','["Actif CT - Passif CT","Capitaux permanents - Actif immobilisé","CA - Charges variables","Résultat + Amortissements"]',1,'FRNG = (Capitaux propres + Dettes LT) - Actif immobilisé net = ressources stables - emplois stables.',1),
('comptabilite-ohada','intermediaire','Un crédit de TVA signifie :','["L''entreprise doit payer de la TVA","La TVA déductible > TVA collectée","La TVA est exonérée","Le client n''a pas payé la TVA"]',1,'Un crédit de TVA apparaît quand les achats soumis à TVA dépassent les ventes sur la période.',1),
('comptabilite-ohada','intermediaire','Le compte 4441 correspond à :','["TVA sur achats","TVA collectée sur ventes","TVA à régulariser","Acomptes TVA"]',1,'Le compte 4441 = État, TVA facturée (collectée). Le 4451 = TVA récupérable sur achats.',1),
('comptabilite-ohada','intermediaire','Lors de la clôture, les charges sont soldées par :','["Report à nouveau","Résultat de l''exercice","Capital","Réserves"]',1,'En fin d''exercice, les comptes de charges (cl.6) et produits (cl.7) sont virés au compte de résultat 12.',1),

-- FISCALITÉ — Débutant
('fiscalite','debutant','Taux IS Congo :','["25%","28%","30%","33%"]',2,'L''Impôt sur les Sociétés au Congo est de 30% du bénéfice fiscal imposable.',1),
('fiscalite','debutant','La déclaration TVA Congo est :','["Mensuelle","Trimestrielle","Annuelle","Semestrielle"]',1,'Au Congo, les entreprises du réel normal déclarent la TVA trimestriellement. Dépôt avant le 20 du mois suivant.',1),
('fiscalite','debutant','NIU signifie :','["N° Interne Unique","N° d''Identification Unique","N° Informatique Unifié","N° Indirect Usuel"]',1,'Le NIU (Numéro d''Identification Unique) est attribué par la DGI. Il remplace l''ancien NIF.',1),
('fiscalite','debutant','DGI signifie :','["Direction Générale des Impôts","Déclaration Générale des Investissements","Direction Gestion Interne","Division des Gains Imposables"]',0,'La DGI = Direction Générale des Impôts, l''administration fiscale du Congo.',1),
('fiscalite','debutant','La DAS (Déclaration des Achats et Services) est déposée :','["Chaque mois","Chaque trimestre","Une fois par an avant le 31 mars","Avant le 20 janvier"]',2,'La DAS est une déclaration annuelle à déposer avant le 31 mars pour l''exercice précédent.',1),
('fiscalite','debutant','Un micro-entrepreneur au Congo paie l''IS sur :','["Son bénéfice réel","Un forfait simplifié","Le chiffre d''affaires × 3%","Il en est exonéré"]',1,'Le régime micro simplifie le calcul. L''impôt est forfaitaire selon le CA, sans calcul du bénéfice réel.',1),
('fiscalite','debutant','Le délai de conservation des documents fiscaux au Congo est de :','["3 ans","5 ans","10 ans","15 ans"]',2,'Le délai de prescription fiscale au Congo est de 10 ans. Conservez tous vos justificatifs 10 ans.',1),

-- RH & PAIE
('rh-paie','debutant','CNSS salarié Congo :','["4%","4,5%","5,04%","6%"]',2,'La cotisation CNSS à la charge du salarié au Congo est de 5,04% du salaire brut (plafonné à 1 500 000 FCFA).',1),
('rh-paie','debutant','Plafond CNSS Congo (mensuel) :','["1 000 000","1 500 000","2 000 000","3 000 000"]',1,'Le plafond de cotisation CNSS au Congo est de 1 500 000 FCFA par mois.',1),
('rh-paie','debutant','CNSS patronal Congo :','["10%","12%","14,36%","16%"]',2,'La cotisation CNSS patronale au Congo est de 14,36% du salaire brut (plafonné).',1),
('rh-paie','debutant','La durée du préavis pour un cadre en Congo est de :','["15 jours","1 mois","3 mois","6 mois"]',2,'Pour les cadres au Congo, le délai de préavis légal est de 3 mois en cas de licenciement ou démission.',1),
('rh-paie','debutant','NET = Salaire brut − CNSS salarié − ?','["CNSS patronal","IRPP","IS","CA"]',1,'Le salaire net = Salaire brut − CNSS salarié − IRPP (impôt sur le revenu des personnes physiques).',1),
('rh-paie','debutant','La cotisation médecine du travail (patronale) est de :','["0,25%","0,50%","1%","2%"]',1,'La cotisation médecine du travail à la charge de l''employeur est de 0,50% du salaire brut.',1),
('rh-paie','debutant','L''indemnité de licenciement au Congo est de :','["10% du salaire × ancienneté","25% du salaire mensuel × années","1 mois par année travaillée","50% du salaire de base"]',1,'L''indemnité de licenciement au Congo est calculée à raison de 25% du salaire mensuel moyen par année d''ancienneté.',1),

-- AUDIT
('audit','debutant','COSO est :','["Un logiciel d''audit","Un référentiel de contrôle interne","Une norme comptable","Un organisme de certification"]',1,'Le COSO (Committee of Sponsoring Organizations) est le référentiel international de contrôle interne à 5 composantes.',1),
('audit','debutant','L''audit interne est effectué par :','["Un commissaire aux comptes externe","Un salarié de l''entreprise","La DGI","Un notaire"]',1,'L''auditeur interne est un salarié ou prestataire mandaté par la direction générale, distinct du CAC externe.',1),
('audit','debutant','Le risque d''audit se calcule par :','["Probabilité + Impact","Probabilité × Impact","(Probabilité − Impact) × 100","Impact / Probabilité"]',1,'Le score de risque = Probabilité × Impact (chacun noté de 1 à 5).',1),
('audit','debutant','La ségrégation des tâches signifie :','["Un seul employé gère tout","Les mêmes fonctions sont séparées entre plusieurs personnes","Les tâches sont supprimées","L''audit est externalisé"]',1,'La ségrégation des tâches consiste à séparer les fonctions incompatibles : autorisation, exécution, enregistrement et contrôle.',1),
('audit','debutant','Un audit de conformité vérifie :','["La rentabilité","Le respect des procédures et réglementations","La valeur des actifs","Les résultats financiers"]',1,'L''audit de conformité évalue si les pratiques respectent les règles internes et externes applicables.',1),

-- TRÉSORERIE
('tresorerie','debutant','BFR = ?','["FRNG − Trésorerie","(Stocks+Créances) − Dettes fournisseurs","Actif − Passif","Capital − Immobilisations"]',1,'BFR = (Stocks + Créances clients) - Dettes fournisseurs. C''est le besoin de financement du cycle d''exploitation.',1),
('tresorerie','debutant','Liquidité générale idéale :','["> 0,5","> 1","> 1,5","> 2"]',2,'Le ratio de liquidité générale idéal est supérieur à 1,5, signifiant que l''actif CT couvre 1,5 fois le passif CT.',1),
('tresorerie','debutant','FRNG = ?','["Capitaux permanents − Actif immobilisé","Actif CT − Passif CT","BFR + Trésorerie","CA − Charges"]',0,'FRNG = (Capitaux propres + Dettes long terme) - Actif immobilisé. C''est l''excédent de ressources stables.',1),
('tresorerie','debutant','Trésorerie nette = ?','["FRNG − BFR","BFR − FRNG","Actif − Passif","CA − Charges"]',0,'Trésorerie nette = FRNG − BFR. Si positif, l''entreprise a des disponibilités après avoir financé son cycle d''exploitation.',1),
('tresorerie','debutant','Un BFR négatif signifie :','["L''entreprise est en déficit","Les fournisseurs financent l''exploitation — situation favorable","L''entreprise n''a pas de stocks","L''entreprise n''a pas de clients"]',1,'Un BFR négatif = les dettes fournisseurs > stocks + créances. Courant dans la grande distribution.',1),

-- GESTION CLINIQUE
('gestion-clinique','debutant','Le dossier médical doit être conservé pendant :','["5 ans","10 ans","20 ans","Toute la vie du patient"]',2,'Au Congo, le dossier médical doit être conservé 20 ans minimum selon les règles de responsabilité médicale.',1),
('gestion-clinique','debutant','CAMU couvre quelle proportion des soins au Congo ?','["50%","70%","80%","100%"]',2,'La CAMU (Couverture Assurance Maladie Universelle) couvre 80% des soins pour les affiliés.',1),
('gestion-clinique','debutant','CIM-10 est :','["Classification Internationale des Maladies","Contrôle Interne Médical","Code International des Médicaments","Certificat Infirmier Médical"]',0,'CIM-10 = 10e révision de la Classification Internationale des Maladies de l''OMS.',1),
('gestion-clinique','debutant','La facturation des soins médicaux au Congo est :','["Exonérée de TVA","Soumise à TVA 18%","Soumise à IS uniquement","Soumise à patente uniquement"]',0,'Les soins médicaux sont exonérés de TVA au Congo. Seules les prestations non médicales (hébergement hôtelier) peuvent être soumises à TVA.',1),

-- GESTION RESTAURANT
('gestion-restaurant','debutant','Le food cost idéal en restauration est :','["< 10%","28-35%","50-60%","70-80%"]',1,'Le coût matière (food cost) idéal en restauration est entre 28% et 35% du prix de vente.',1),
('gestion-restaurant','debutant','HACCP est :','["Un label de qualité","Une méthode d''analyse des risques alimentaires","Un logiciel de caisse","Un ratio de rentabilité"]',1,'HACCP = Hazard Analysis Critical Control Points. C''est la méthode internationale d''hygiène et sécurité alimentaire.',1),
('gestion-restaurant','debutant','Le ticket moyen s''obtient par :','["CA / Nombre de couverts","CA / Nombre de plats","Charges / CA","CA − Charges"]',0,'Ticket moyen = Chiffre d''affaires / Nombre de couverts servis sur la même période.',1),
('gestion-restaurant','debutant','La DLC signifie :','["Date Limite de Commercialisation","Date Limite de Consommation","Délai Légal de Conservation","Date de Livraison Confirmée"]',1,'DLC = Date Limite de Consommation. Après cette date, le produit ne doit PLUS être consommé.',1),

-- GESTION HÔTELIÈRE
('gestion-hoteliere','debutant','RevPAR se calcule par :','["CA / Chambres disponibles","CA / Chambres occupées","Tarif moyen × Taux d''occupation","A et C sont identiques"]',2,'RevPAR = Revenue Per Available Room = Tarif moyen × Taux d''occupation. C''est l''indicateur clé de l''hôtellerie.',1),
('gestion-hoteliere','debutant','OTA signifie :','["Online Travel Agency","Official Tourism Authority","Open Travel Account","Outbound Tourism Association"]',0,'OTA = Online Travel Agency. Exemples : Booking.com, Expedia, Hotels.com.',1),
('gestion-hoteliere','debutant','Le taux d''occupation cible en hôtellerie est :','["30-40%","50-60%","65-80%","95-100%"]',2,'Un bon hôtel vise un taux d''occupation de 65% à 80% pour être rentable.',1),

-- CONTRÔLE DE GESTION
('controle-gestion','debutant','Un KPI doit être SMART — que signifie le M ?','["Motivant","Mesurable","Mensuel","Maximisé"]',1,'SMART = Spécifique, Mesurable, Atteignable, Relevant, Temporel.',1),
('controle-gestion','debutant','L''écart sur prix de vente = ?','["(Prix réel − Prix standard) × Quantités réelles","CA réel − CA standard","Charges réelles − Charges budgétées","Volume réel − Volume budgété"]',0,'Écart sur prix = (Prix réel - Prix budgété) × Quantités réelles vendues.',1),
('controle-gestion','debutant','Le seuil de rentabilité (point mort) est atteint quand :','["CA = Charges variables","CA = Charges fixes","Marge sur coûts variables = Charges fixes","Résultat = Capitaux propres"]',2,'Le seuil de rentabilité est le niveau de CA où la marge sur coûts variables couvre exactement les charges fixes.',1),

-- FINANCE
('finance','debutant','Le ROE mesure :','["La rentabilité des actifs","La rentabilité des capitaux propres","La liquidité","L''endettement"]',1,'ROE = Return on Equity = Résultat net / Capitaux propres × 100.',1),
('finance','debutant','Un ratio d''endettement (gearing) > 1 signifie :','["L''entreprise est bien capitalisée","L''entreprise a plus de dettes que de capitaux propres","L''entreprise est en croissance","Le résultat est positif"]',1,'Gearing = Dettes financières / Capitaux propres. Au-delà de 1, les dettes dépassent les fonds propres.',1),
('finance','debutant','L''EBITDA est :','["Résultat net","Résultat avant intérêts, impôts, amortissements et provisions","Chiffre d''affaires − Charges","Bénéfice distribuable"]',1,'EBITDA = Earnings Before Interest, Taxes, Depreciation and Amortization = Excédent Brut d''Exploitation en français.',1),

-- MANAGEMENT
('management','debutant','SMART : un objectif doit être Spécifique, Mesurable, Atteignable, Relevant et :','["Simple","Temporel","Stimulant","Systémique"]',1,'Le T de SMART = Temporel, c''est-à-dire défini dans le temps avec une date limite précise.',1),
('management','debutant','Le style de management situationnel adapte :','["La rémunération selon les performances","Le style de management au niveau de maturité du collaborateur","Les objectifs selon le marché","Les procédures à chaque client"]',1,'Le management situationnel (Hersey & Blanchard) adapte le style (directif/délégatif) au niveau d''autonomie et motivation du collaborateur.',1),

-- GESTION DE STOCK
('gestion-stock','debutant','FIFO signifie :','["First In, First Out","First Invoice, First Out","Fast Item, Fast Order","First Internal, First Output"]',0,'FIFO = First In, First Out = Premier Entré, Premier Sorti. Les premiers stocks reçus sont les premiers utilisés ou vendus.',1),
('gestion-stock','debutant','Dans l''analyse ABC, les articles A représentent :','["80% du nombre d''articles","80% de la valeur du stock","50% des commandes","20% de la valeur"]',1,'La catégorie A = 20% des articles mais 80% de la valeur. Ce sont les articles à fort enjeu financier.',1),

-- ENTREPRENEURIAT
('entrepreneuriat','debutant','Le capital minimum d''une SARL au Congo est :','["50 000 FCFA","100 000 FCFA","500 000 FCFA","1 000 000 FCFA"]',1,'Le capital minimum d''une SARL au Congo-Brazzaville est de 100 000 FCFA selon l''Acte Uniforme OHADA.',1),
('entrepreneuriat','debutant','RCCM signifie :','["Registre Central du Commerce Ministériel","Registre du Commerce et du Crédit Mobilier","Registre Comptable des Commerces du Monde","Répertoire des Commerçants du Congo-Monde"]',1,'RCCM = Registre du Commerce et du Crédit Mobilier. C''est l''équivalent du K-bis en France.',1),
('entrepreneuriat','debutant','Le GUFE au Congo est :','["La banque des entrepreneurs","Le Guichet Unique de Formalisation des Entreprises","La garantie des fonds propres","Le guide unique fiscal des entreprises"]',1,'GUFE = Guichet Unique de Formalisation des Entreprises — point central pour créer une entreprise au Congo.',1),

-- ONG & ASSOCIATIONS
('ong-associations','debutant','Le cadre logique d''un projet ONG comprend :','["Inputs, Outputs, Outcomes, Impact","Coûts, Revenus, Bénéfices, Pertes","Stratégie, Tactique, Opérations, Contrôle","Vision, Mission, Objectifs, Actions"]',0,'Le cadre logique ONG (LogFrame) = Inputs (ressources) → Outputs (livrables) → Outcomes (résultats) → Impact (changement durable).',1),
('ong-associations','debutant','Un rapport bailleur contient obligatoirement :','["Seulement le bilan financier","Narratif + financier + pièces justificatives","Uniquement les activités réalisées","La liste des bénéficiaires uniquement"]',1,'Le rapport bailleur combine toujours un rapport narratif des activités ET un rapport financier avec pièces justificatives.',1),

-- BANQUE & MICROFINANCE
('banque-microfinance','debutant','COBAC signifie :','["Commission Bancaire Africaine Centrale","Commission Bancaire de l''Afrique Centrale","Comité Banquier de l''Afrique du Congo","Centrale Obligatoire des Banques Africaines du Congo"]',1,'COBAC = Commission Bancaire de l''Afrique Centrale. Elle supervise les banques et IMF dans la zone CEMAC.',1),
('banque-microfinance','debutant','KYC signifie :','["Know Your Client","Keep Your Cash","Key Yield Calculator","Know Your Currency"]',0,'KYC = Know Your Customer (Connaître son Client). Obligation réglementaire de vérification de l''identité des clients.',1),
('banque-microfinance','debutant','LAB/FT signifie :','["Lutte Anti-Blanchiment / Financement du Terrorisme","Liste des Activités Bancaires","Loi sur les Avantages Bancaires","Limite d''Autorisation Bancaire"]',0,'LAB/FT = Lutte Anti-Blanchiment et contre le Financement du Terrorisme. Obligation stricte pour toutes les institutions financières.',1),

-- AGRICULTURE
('agriculture-elevage','debutant','NPK en agriculture désigne :','["Nitrates, Potassium, Kali","Azote (N), Phosphore (P), Potassium (K)","Nutrition, Production, Kilogramme","Naturel, Protéiné, Kakao"]',1,'NPK = Azote (N), Phosphore (P), Potassium (K). Ce sont les 3 macronutriments essentiels des engrais.',1),
('agriculture-elevage','debutant','FIFO en gestion des récoltes signifie :','["Congeler d''abord les premières récoltes","Vendre en premier ce qui a été récolté en premier","Irriguer avant de fertiliser","Fertiliser avant d''irriguer"]',1,'En agriculture, FIFO = First In, First Out. Les premières récoltes doivent être vendues ou transformées en priorité.',1),

-- GÉNIE CIVIL & BTP
('genie-civil-btp','debutant','ARMP au Congo est :','["L''Agence de Régulation des Marchés Publics","L''Autorité de Règlement des Marchés Privés","L''Association de Réhabilitation des Marchés Populaires","L''Administration des Routes et Marchés Publics"]',0,'ARMP = Agence de Régulation des Marchés Publics. Elle supervise les appels d''offres publics au Congo.',1),
('genie-civil-btp','debutant','Un métré BTP consiste à :','["Calculer les délais","Mesurer et quantifier les travaux pour le devis","Contrôler la qualité des matériaux","Établir le planning Gantt"]',1,'Le métré = opération de mesure et quantification de tous les travaux nécessaires pour établir le devis.',1),

-- CABINET COMPTABLE
('cabinet-comptable','debutant','L''ONECCA est :','["La banque des comptables","L''Ordre National des Experts Comptables et Comptables Agréés du Congo","La norme OHADA","L''outil numérique des cabinets"]',1,'ONECCA = Ordre National des Experts Comptables et Comptables Agréés. Obligatoire pour exercer en cabinet au Congo.',1),
('cabinet-comptable','debutant','La liasse fiscale est :','["Le dossier de création d''entreprise","L''ensemble des déclarations fiscales annuelles obligatoires","La liste des clients","Le registre du personnel"]',1,'La liasse fiscale = ensemble des formulaires fiscaux déposés annuellement à la DGI (bilan, compte de résultat, annexes, IS...).',1),

-- GESTION PHARMACIE
('gestion-pharmacie','debutant','FEFO en pharmacie signifie :','["First Entry, First Out","First Expired, First Out","Fast Entry, Fast Order","Final Expiry, Final Output"]',1,'FEFO = First Expired, First Out. En pharmacie, les médicaments dont la date d''expiration est la plus proche doivent être utilisés en premier.',1),
('gestion-pharmacie','debutant','Les stupéfiants en pharmacie sont soumis à :','["Aucune règle spéciale","Un registre spécial et une réglementation stricte","La même gestion que les autres médicaments","La décision du pharmacien"]',1,'Les stupéfiants sont soumis à une réglementation stricte : registre spécial, stockage sécurisé, déclarations aux autorités.',1),

-- GESTION ÉCOLE
('gestion-ecole','debutant','DPEI au Congo est :','["Direction des Projets Éducatifs Internes","Direction de la Planification de l''Éducation et des Infrastructures","Département Pédagogique et d''Évaluation Interne","Division des Programmes d''Enseignement Intégré"]',1,'DPEI = Direction de la Planification de l''Éducation et des Infrastructures. Elle gère les statistiques scolaires au Congo.',1),
('gestion-ecole','debutant','Le CRE (Congo) est :','["Le Code de Réglementation des Écoles","Le Conseil de Représentation des Élèves","Le Comité de Réforme de l''Enseignement","Le Centre de Ressources Educatives"]',2,'CRE = Comité de Réforme de l''Enseignement — instance de gouvernance du système éducatif congolais.',1),

-- LEADERSHIP
('leadership','debutant','Le leadership transformationnel consiste à :','["Fixer des règles strictes","Inspirer et motiver par une vision","Contrôler chaque détail","Récompenser uniquement les résultats"]',1,'Le leadership transformationnel inspire par la vision, encourage l''innovation et développe les potentiels.',1),
('leadership','debutant','L''intelligence émotionnelle d''un leader comprend :','["Uniquement la maîtrise de soi","Conscience de soi, maîtrise de soi, empathie, compétences sociales","La capacité à prendre des décisions rapides","La connaissance technique du métier"]',1,'L''intelligence émotionnelle (Goleman) = conscience de soi + maîtrise de soi + motivation + empathie + compétences sociales.',1),

-- CRM & VENTE
('crm-vente','debutant','BANT est une méthode de :','["Facturation","Qualification des leads","Gestion des réclamations","Analyse financière"]',1,'BANT = Budget, Authority, Need, Timeline. C''est une méthode de qualification des prospects commerciaux.',1),
('crm-vente','debutant','La LTV (Life Time Value) mesure :','["Le dernier achat d''un client","La valeur totale d''un client sur toute la durée de la relation","Le coût d''acquisition d''un client","Le délai moyen de paiement"]',1,'LTV = chiffre d''affaires total généré par un client sur toute la durée de la relation commerciale.',1)

ON CONFLICT DO NOTHING;
