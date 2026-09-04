---
name: audit-comptable
description: Utilise ce skill pour tout module d'audit, de contrôle interne ou de validation des comptes dans oraforme — procédures d'audit, détection d'anomalies comptables, contrôle de cohérence des écritures, pistes d'audit (audit trail), séparation des tâches, validation pré/post-migration des données financières, et conformité aux normes d'audit OHADA. Déclenche-le systématiquement avant et après toute migration touchant journal_entries, journal_comptable, ou tout compte SYSCOHADA — ainsi que pour tout module de revue de comptes, rapprochement bancaire, ou contrôle qualité des données financières.
---

# Audit Comptable & Contrôle Interne — oraforme

## Frontière avec les autres skills

Ce skill couvre la **vérification** et le **contrôle** des données comptables et financières — pas leur production (skill `ohada-comptabilite`) ni leur analyse de pilotage (skill `controle-gestion`). Il s'applique en particulier aux opérations techniques sensibles : migrations de schéma touchant les tables comptables, imports de masse, corrections de données historiques.

## Principe d'or pour toute migration touchant les données comptables

**Aucune migration ne doit s'exécuter sans un contrôle avant/après.** Séquence obligatoire :

1. **Snapshot avant migration** : capturer un état de référence vérifiable (sommes de contrôle, totaux par compte, nombre de lignes) avant toute modification de structure ou de données
2. **Exécution de la migration**
3. **Snapshot après migration** : recalculer les mêmes indicateurs
4. **Réconciliation** : comparer avant/après — toute différence doit être **expliquée et justifiée**, jamais simplement constatée puis ignorée
5. **Validation de l'équilibre comptable** : pour toute table de type `journal_entries`/`journal_comptable`, vérifier que la partie double reste respectée — total des débits = total des crédits, à la fois globalement et par pièce comptable individuelle

### Contrôles de cohérence systématiques pour `journal_entries` / `journal_comptable`

À exécuter avant et après chaque migration, et idéalement en contrôle continu (job planifié) :

```sql
-- Vérification équilibre global (débit = crédit) par pièce comptable
-- Toute pièce avec un écart != 0 est une anomalie bloquante
SELECT piece_id, SUM(debit) - SUM(credit) AS ecart
FROM journal_entries
GROUP BY piece_id
HAVING SUM(debit) - SUM(credit) != 0;

-- Détection de comptes inexistants ou hors plan SYSCOHADA
-- (numéro de compte ne correspondant à aucune classe 1-8 valide)
SELECT DISTINCT numero_compte
FROM journal_entries
WHERE numero_compte NOT IN (SELECT numero_compte FROM plan_comptable);

-- Détection de doublons de pièces comptables (même référence, même montant, même date)
SELECT numero_piece, date_piece, montant, COUNT(*)
FROM journal_entries
GROUP BY numero_piece, date_piece, montant
HAVING COUNT(*) > 1;

-- Détection d'écritures orphelines (sans tenant_id ou company_id rattaché)
SELECT * FROM journal_entries WHERE company_id IS NULL;

-- Vérification de la continuité de la numérotation des pièces (pas de trou dans la séquence)
-- Important pour la valeur probante du journal vis-à-vis de l'administration fiscale
```

**Pour oraforme spécifiquement** : avant toute migration de schéma sur les tables comptables, exécuter ces contrôles via le MCP Postgres connecté, et conserver les résultats (avant/après) comme preuve d'intégrité — ne jamais se contenter d'une exécution silencieuse de la migration.

## Anomalies comptables typiques à détecter (catalogue de contrôle)

| Type d'anomalie | Comment la détecter | Gravité |
|---|---|---|
| **Déséquilibre débit/crédit** | Somme débits ≠ somme crédits sur une pièce | Bloquante — viole le principe de partie double |
| **Compte inexistant/erroné** | Numéro de compte hors plan SYSCOHADA validé | Bloquante |
| **Doublon d'écriture** | Même référence/montant/date répétés | Élevée |
| **Écriture orpheline** | Sans tenant/company_id, sans pièce justificative liée | Élevée |
| **Rupture de séquence de pièces** | Trou dans la numérotation chronologique | Moyenne — risque de rejet fiscal |
| **Écart de rapprochement bancaire** | Solde comptable banque ≠ solde relevé bancaire | Variable selon montant |
| **Antidatage suspect** | Date de saisie système très postérieure à la date de pièce, sur un exercice déjà clos | Élevée — risque de fraude ou correction non tracée |
| **Montant à zéro ou négatif sur un compte qui ne devrait jamais l'être** | Ex: stock négatif, capital négatif sans justification | Moyenne à élevée selon le compte |

## Piste d'audit (audit trail) — exigences pour oraforme

Toute donnée comptable modifiée doit conserver une trace immuable :
- **Qui** : utilisateur ou processus ayant effectué la modification
- **Quand** : horodatage exact (et non simplement la date de la pièce comptable)
- **Quoi** : valeur avant / valeur après
- **Pourquoi** (si applicable) : référence à une pièce justificative, une régularisation, ou un motif de correction

**Principe d'immuabilité** : une écriture comptable validée ne doit jamais être supprimée ou modifiée directement en base — toute correction doit passer par une **écriture de contre-passation** (extourne) suivie d'une nouvelle écriture correcte, conformément aux usages comptables OHADA. Le module de correction d'écritures d'oraforme doit imposer ce mécanisme plutôt que d'autoriser un UPDATE direct sur une ligne déjà validée.

## Séparation des tâches (segregation of duties) — principe de contrôle interne

Pour tout module financier sensible, vérifier que l'architecture applicative empêche structurellement qu'une même personne puisse, seule :
- Créer un fournisseur ET valider un paiement à ce fournisseur
- Saisir une écriture ET la valider/clôturer
- Créer un utilisateur ET lui attribuer des droits d'administration financière

Si oraforme ne dispose pas encore de ce contrôle par les rôles (RBAC), c'est un axe d'audit prioritaire à signaler — la non-séparation des tâches est l'une des failles de contrôle interne les plus fréquemment relevées en audit.

## Rapprochement bancaire — procédure standard

1. Récupération du solde comptable du compte banque (classe 52 SYSCOHADA) à une date donnée
2. Récupération du solde du relevé bancaire à la même date
3. Identification des écarts :
   - **Chèques émis non encore débités** (écriture comptable existe, pas encore sur le relevé)
   - **Virements reçus non encore comptabilisés** (sur le relevé, pas encore en comptabilité)
   - **Erreurs de saisie** (montant, sens, compte)
4. Production d'un état de rapprochement documentant chaque écart résiduel
5. Le rapprochement doit "boucler" : Solde comptable ± écarts identifiés = Solde bancaire

Module recommandé pour oraforme : import automatisé de relevés bancaires (formats courants : CSV, OFX, MT940 si disponible auprès des banques CEMAC) avec rapprochement assisté par règles de correspondance (montant + date approximative).

## Checklist de validation avant clôture d'exercice

- [ ] Toutes les pièces comptables de l'exercice sont équilibrées (débit = crédit)
- [ ] Aucune écriture en attente de validation ("brouillon") sur l'exercice à clôturer
- [ ] Rapprochements bancaires effectués sur tous les comptes de trésorerie jusqu'à la date de clôture
- [ ] Inventaire physique des stocks réalisé et écart de stock comptabilisé (si applicable)
- [ ] Amortissements de l'exercice calculés et comptabilisés sur toutes les immobilisations actives
- [ ] Provisions revues (constitution, ajustement, ou reprise selon l'évolution des risques)
- [ ] Comptes d'attente (comptes transitoires, comptes 47x) soldés ou justifiés
- [ ] Déclarations fiscales de la période (TVA, acomptes IS) toutes déposées et concordantes avec la comptabilité
- [ ] États financiers (Bilan, Compte de résultat, TAFIRE, Notes annexes) générés et cohérents entre eux

## Quand rechercher avant de coder

- Avant d'implémenter un contrôle spécifique à une norme d'audit internationale (ISA — International Standards on Auditing) au-delà des principes OHADA de base, rechercher la norme précise si le projet vise une certification externe
- Les seuils de matérialité (à partir de quel montant une anomalie devient "significative") varient selon la taille de l'entreprise — ne pas coder un seuil universel sans validation avec l'utilisateur métier

## Limites de ce skill

Pour la production des écritures et états financiers eux-mêmes → voir skill `ohada-comptabilite`.
Pour l'analyse de pilotage et les indicateurs de gestion → voir skill `controle-gestion`.
Pour les procédures judiciaires en cas de fraude avérée (plainte, expertise judiciaire) → hors périmètre technique, relève du conseil juridique.
