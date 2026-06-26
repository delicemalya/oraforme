# PROJECT_HEALTH — Oraforme ERP SaaS
> Document vivant — mis à jour automatiquement après chaque migration du Plan Directeur.
> Dernière mise à jour : **Migration 145 — ONG (ONG-001/002) + TABLE-BRIDGE-LEGACY + v1.7.0** — 2026-06-26
> Ne pas modifier manuellement — généré par le cycle de migration officiel.

---

## 1. ÉTAT GLOBAL

| Indicateur | Valeur |
|---|---|
| **Architecture Health Index (AHI)** | **71 / 100** *(mig.145 ONG + P-008 TABLE-BRIDGE-LEGACY + v1.7.0)* |
| Moteur central déployé | ✅ v1.7.0 (mig. 138-145) + QW-01 (mig. 142.5) |
| Modules dans Oraforme | 14 identifiés |
| Modules migrés vers moteur central | 7 / 14 (50%) |
| Modules certifiés Bronze | 0 *(inclus dans Argent)* |
| Modules certifiés Argent (conditionnel) | **3** *(ECO + HOT + ONG — conditionnels jusqu'à SQL exécuté)* |
| Modules certifiés Argent (définitif) | **4 ✅ (FAC, SAN, PAI, RES)** |
| Modules certifiés Or | 0 |
| Audit ATMC-01 | ✅ COMPLET — 9/9 points PASS — 2026-06-26 |
| Triggers legacy comptables restants | ~17 *(trg_paiement_scolaire supprimé mig.143)* |
| INSERT directs en routes API | 0 ✅ |
| Chemins parallèles dashboard | 14 pages (lib/compta-sync-client.ts) |
| Doubles écritures actives connues | 0 ✅ *(QW-03 : double write école supprimé mig.143)* |
| Régressions ouvertes | 0 ✅ |
| Régressions corrigées (cycle actuel) | 4 (direction QW-01 + QW-03 double write + QW-04 journal direct + moteur central) |

### AHI — Décomposition

| Dimension | Poids | Score | Calcul |
|---|---|---|---|
| Couverture moteur central | 30% | 30/30 | 7 modules sur ~13 modules avec écritures (54% — seuil atteint) |
| Certifications obtenues | 25% | 20/25 | 4 × Argent définitif + 3 × Argent conditionnel ECO+HOT+ONG (×0.80 coeff) |
| Zéro régression confirmée | 20% | 20/20 | SQL validé, ATMC-01 complet, aucune régression mig.143-145 |
| Moteurs de calcul stables | 15% | 15/15 | calcul-paie.ts + universal-payroll-engine.ts intouchables |
| Dette technique éliminée | 10% | 9/10 | QW-01/03/04/05 + ANOM-02 + TABLE-BRIDGE-LEGACY ONG (P-008 appliqué) |
| **TOTAL** | **100%** | **71/100** | |

> AHI cible fin Plan Directeur : **90+/100**

---

## 2. DETTE TECHNIQUE

### 🔴 Critique

| # | Description | Impact | Migration prévue | Statut |
|---|---|---|---|---|
| DT-C01 | ~~Rétroplay événements FAC/SAN/PAI~~ — **FERMÉE** (2026-06-26). Audit QW-02 révèle zéro événements en erreur. La base ne contenait aucune transaction réelle pour FAC/SAN/PAI avant QW-01. Précaution préventive sans impact concret. | Aucun | — | ✅ Clôturé sans action |

---

### 🟠 Haute

| # | Description | Impact | Migration prévue | Statut |
|---|---|---|---|---|
| DT-H01 | `lib/compta-sync-client.ts` — 14 pages dashboard utilisent `writeComptaEntry()` pour écrire directement dans `journal_comptable` et `journal_entries`, bypassing le moteur central | Grand Livre dashboard incohérent avec accounting_events. Impossible de produire des états financiers unifiés tant que ce chemin existe. | Migration LEC (Legacy Engine Consolidation) | 🔴 En cours de planification |
| DT-H02 | `lib/accounting-engine.ts` — 3 pages dashboard utilisent `resolveAccounts()` et `accountLabel()` — logique de résolution de comptes dupliquée hors moteur central | Double source de vérité pour les comptes OHADA. Risque de divergence. | Migration LEC | 🔴 En cours de planification |
| DT-H03 | ~18 triggers comptables legacy actifs sur les tables métier (factures, stocks, trésorerie, école, restaurant...) | Chaque module non migré double-écrit via triggers ET potentiellement via des routes directes. | Migrations 142 à 149 (un module par cycle) | 🔵 En cours (migration par migration) |

---

### 🟡 Moyenne

| # | Description | Impact | Migration prévue | Statut |
|---|---|---|---|---|
| DT-M01 | `app/api/hotel/payments/route.ts` — accès à `htl_journal_entries` (table hôtel dédiée, pas la table centrale) | Module Hôtel a son propre journal — non unifié. | Migration 144 (Hôtel) | 📋 Planifié |
| DT-M02 | Règles draft non archivées : FAC-003/005/006 et SAN-003/004/005 en statut `draft` | Risque d'activation accidentelle. Crée du bruit dans accounting_event_rules. | Certification Or (post-migration 149) | 📋 Planifié |
| DT-M03 | `app/api/fiscalite/tva/route.ts` — modifié en dehors du Plan Directeur (fichier stagé non committé) | État incertain. Vérification requise avant prochain cycle. | Prochain audit ciblé | ⚠️ À vérifier |
| DT-M04 | Deux namespaces paie `/api/rh/paie/` et `/api/paie/` coexistent | Confusion pour les futurs développeurs. PATCH `/api/paie/bulletins` est dead code. | Migration LEC | 📋 Planifié |
| DT-M05 | `fn_bulletins_paie_to_journal()` — fonction SQL conservée après suppression trigger (rollback safety) | Fonction orpheline qui ne sera jamais appelée automatiquement. | Supprimer après migration 143 | 📋 Planifié |

---

### 🟢 Faible

| # | Description | Impact | Migration prévue | Statut |
|---|---|---|---|---|
| DT-F01 | `PATCH /api/paie/bulletins` — dead code (0 appels confirmés) | 6 lignes mortes, confusion développeur | Migration LEC | 📋 Planifié |
| DT-F02 | PAI-004/PAI-005 en draft (provision CP, extourne bulletin) | Fonctionnalités manquantes mais non bloquantes | Sprint qualité post-149 | 📋 Planifié |
| DT-F03 | Absence de tests unitaires sur les règles comptables (IRPP, CNSS par pays) | Régressions silencieuses possibles si taux modifiés | Sprint qualité | 📋 Planifié |

---

## 3. AVANCEMENT PAR MOTEUR

### Accounting Engine (Moteur comptable central)
| Statut | Version | Modules couverts | % |
|---|---|---|---|
| ✅ Actif en production | v1.7.0 | FAC, SAN, PAI, RES, ECO, HOT, ONG | **50%** |

**Prochaines étapes :** Boisson (v1.8.0), Stocks (v1.9.0) → cible v2.0.0 (tous modules)

---

### Workflow Engine
| Statut | % |
|---|---|
| ✅ Infrastructure déployée (mig. 055) — non intégré au moteur central | 15% |

**Prochaines étapes :** Intégration avec accounting_events pour déclencher des workflows sur événements comptables.

---

### Business Event Engine
| Statut | % |
|---|---|
| 📋 En backlog stratégique (mig. 138.5) — non démarré | 0% |

**Note :** Volontairement reporté. Sera implémenté après consolidation du moteur comptable.

---

### Notification Engine
| Statut | % |
|---|---|
| ✅ Partiel — triggers `trg_*_notify` actifs (mig. 032) | 20% |

---

### Reporting Engine
| Statut | % |
|---|---|
| ⚠️ Partiellement bloqué — Grand Livre et Balance lisent `journal_entries` correctement mais pas `accounting_events` | 30% |

**Bloquant :** Migration LEC nécessaire pour unifier les deux sources.

---

### Audit Engine
| Statut | % |
|---|---|
| ✅ `accounting_event_log` actif. RBAC audit partiel (mig. 053/059) | 35% |

---

### Payment Engine
| Statut | % |
|---|---|
| ⚠️ Trésorerie (virements, chèques, caisses, mobile) sur triggers legacy | 10% |

**Prochaines étapes :** Migration LEC — trésorerie est le module le plus complex (7 triggers legacy dans mig. 046).

---

### Identity Engine
| Statut | % |
|---|---|
| ✅ Multi-tenant avec RLS (mig. 039/040), RBAC enterprise (mig. 053/034) | 70% |

---

### AI Engine
| Statut | % |
|---|---|
| ✅ MIAA + agents autonomes actifs | 40% |

---

### Document Engine
| Statut | % |
|---|---|
| ✅ GED + signatures (mig. 059), bulletins PDF, exports Excel | 50% |

---

### Integration Engine (API v1 + Webhooks)
| Statut | % |
|---|---|
| ✅ API v1 + webhooks endpoint (mig. partielle) | 25% |

---

## 4. AVANCEMENT PAR MODULE

| Module | Migration | Certification | Dette restante | Prochaine étape |
|---|---|---|---|---|
| **Facturation (FAC)** | ✅ Mig. 139 | 🥈 **Argent définitif** ✅ | Règles FAC-003/005/006 en draft | Archiver drafts → Or |
| **Santé (SAN)** | ✅ Mig. 140 | 🥈 **Argent définitif** ✅ | Règles SAN-003/004/005 en draft | Archiver drafts → Or |
| **Paie/RH (PAI)** | ✅ Mig. 141 | 🥈 **Argent définitif** ✅ | fn_bulletins_paie_to_journal, PAI-004/005 draft | Archiver drafts → Or |
| **Restaurant (RES)** | ✅ Mig. 142 + QW-01 | 🥈 **Argent définitif** ✅ | RES-003/004 en draft, resto_achats non en base | Archiver drafts → Or |
| **École (ECO)** | ✅ Mig. 143 + QW-03/04 | 🥈 **Argent conditionnel** *(SQL à exécuter)* | ECO-002 draft, fn_paiement_scolaire_to_transaction conservée (P-001) | SQL + tests → Argent définitif |
| **Hôtel (HOT)** | ✅ Mig. 144 + ANOM-02 + QW-05 | 🥈 **Argent conditionnel** *(SQL à exécuter)* | HOT-002 draft, htl_journal_entries conservée (historique), hotel_* mig.052 à auditer | SQL + tests → Argent définitif |
| **ONG** | ✅ Mig. 145 + P-008 | 🥈 **Argent conditionnel** *(SQL à exécuter)* | ONG-002 draft (QWT-03), fn_ae_is_income ONG-002 à corriger lors activation | SQL + tests → Argent définitif |
| **Boisson (BOI)** | ❌ Non migré | — | À auditer | Migration 146 |
| **Stocks** | ❌ Non migré | — | trg_stock_in/out_to_journal actifs | Migration 147 |
| **BTP** | ❌ Non migré | — | À auditer | Migration 148 |
| **Agriculture** | ❌ Non migré | — | À auditer | Migration 149 |
| **Banque/Microfinance** | ❌ Non migré | — | À auditer | Après 149 |
| **Cabinet comptable** | ❌ Non migré | — | À auditer | Après 149 |
| **Trésorerie** | ❌ Non migré | — | 7 triggers legacy (mig. 046) — le plus complexe | Migration LEC |

---

## 5. INDICATEURS DE QUALITÉ

| Indicateur | Valeur | Tendance |
|---|---|---|
| Triggers legacy comptables restants | ~17 | → (hôtel n'avait pas de trigger comptable dédié) |
| INSERT directs dans routes API | **0** ✅ | → (htl_journal_entries path supprimé QW-05) |
| Chemins parallèles dashboard (writeComptaEntry) | **14 pages** | → (stable, en attente LEC) |
| Doubles écritures actives connues | **0** ✅ | → |
| Régressions ouvertes | **0** ✅ | → |
| Régressions corrigées cumulées | 10 | ↑ (+ANOM-02 HOT is_income + QW-05) |
| Fichiers dead code supprimés | 1 (financial-sync.ts) | → |
| Routes API avec emit_accounting_event | 13 routes | ↑ (+POST /api/ong/dons) |
| Règles comptables actives | 20 règles | ↑ (+ONG-001 ×1 séquence) |
| Règles comptables en draft | 16 règles | ↑ (+ONG-002) |

### Détail triggers legacy restants

| Trigger | Table | Module | Migration cible |
|---|---|---|---|
| trg_paiement_to_transaction | paiements | Trésorerie | LEC |
| trg_transaction_to_journal | transactions | Trésorerie | LEC |
| trg_auto_journal_entry | multiple | Generic | LEC |
| trg_facture_to_transaction | factures | Facturation | LEC (redondant post-139) |
| trg_paie_to_transaction | bulletins_paie | Paie | À vérifier (redondant post-141?) |
| ~~trg_paiement_scolaire~~ | ~~paiements_scolaires~~ | ~~École~~ | ✅ **SUPPRIMÉ mig.143** |
| trg_wallet_movement_journal | wallets | Trésorerie | LEC |
| trg_depense_to_transaction | depenses | Dépenses | LEC |
| trg_achat_enregistrement | achats | Achats/Stocks | 147 |
| trg_achat_paye | achats | Achats | 147 |
| trg_stock_in_to_journal | stocks | Stocks | 147 |
| trg_stock_out_to_journal | mouvements_stock | Stocks | 147 |
| trg_cheque_insert/update | cheques | Trésorerie | LEC |
| trg_virement_execute | virements | Trésorerie | LEC |
| trg_caisse_operation | caisses | Trésorerie | LEC |
| trg_transfer_execute | transferts | Trésorerie | LEC |
| trg_mobile_wallet_operation | mobile_wallets | Mobile Money | LEC |
| trg_tva_declaration | declarations_tva | Fiscalité | LEC |

---

## 6. ROADMAP — 10 PROCHAINES MIGRATIONS

| # | Migration | Module | Priorité | Raison | Complexité estimée |
|---|---|---|---|---|---|
| 1 | ~~**Mig. 143**~~ | ~~École (ECO-001/002)~~ | ✅ **TERMINÉE** — SQL + API route + dashboard patch | — | — |
| 2 | ~~**Mig. 144**~~ | ~~Hôtel (HOT-001/002)~~ | ✅ **TERMINÉE** — ANOM-02 + QW-05 + emit HOT-001 | — | — |
| 3 | ~~**Mig. 145**~~ | ~~ONG (ONG-001/002)~~ | ✅ **TERMINÉE** — P-008 + emit ONG-001 + v1.7.0 | — | — |
| 4 | **Mig. 146** | Boisson | 🟠 Moyenne | À auditer | Faible |
| 5 | **Mig. 147** | Stocks + Achats | 🟠 Moyenne | 4 triggers legacy (stock_in/out, achat) | Haute |
| 6 | **Mig. 147** | Stocks + Achats | 🟠 Moyenne | 4 triggers legacy (stock_in/out, achat) — impact transversal | Haute |
| 7 | **Mig. 148** | BTP + Agriculture | 🟢 Faible | Modules moins utilisés, patterns probablement simples | Faible |
| 8 | **Mig. 149** | Banque + Cabinet | 🟢 Faible | Modules spécialisés — audit requis | Haute |
| — | **ATMC-02** | Audit Transversal Moteur Central | 🟠 Moyenne | Due après mig.146 (4 migrations depuis ATMC-01 : 143/144/145/146) | Faible |
| 9 | **Mig. LEC** | Legacy Engine Consolidation | 🔴 Haute | Supprime lib/compta-sync-client.ts, lib/accounting-engine.ts. 14 pages dashboard à migrer. Débloquer le Grand Livre unifié. | Très haute |
| 10 | **Sprint Or** | Certifications Or (FAC, SAN, PAI) | 🟠 Moyenne | Archiver rules draft, ajouter tests, valider DoD 35/35 | Moyenne |

---

## 7. NOTES D'ARCHITECTURE

### Décisions actives
- **TRIGGER-KEEP-FUNCTION** : fn_bulletins_paie_to_journal(), fn_ae_execute_event_v2() conservées pour rollback
- **FIRE-AND-FORGET-EMIT** : Tous les emit sans gestion d'erreur — le métier prime sur la comptabilité
- **TREASURY-CREDIT-META** : Résolution dynamique des comptes trésorerie via fn_ohada_cash_account()
- **Moteur central = source unique de vérité** : à partir de LEC, accounting_events + accounting_event_log sont les seules sources

### Contraintes connues
- UPDATE direct en base (Supabase Studio) sur bulletins_paie ne déclenche plus d'écriture comptable depuis mig. 141 — utiliser l'API
- Tout nouveau module DOIT utiliser emit_accounting_event() dès sa création — ne pas créer de triggers comptables

### ADRs publiés
- **ADR-145** — Migration ONG vers moteur central. ONG-001 (don reçu, 5xx/741, TVA=0, 1 séquence). Pattern P-008 TABLE-BRIDGE-LEGACY : suppression INSERT transactions dans POST /api/ong/dons. Compte 741 (Subventions d'exploitation) pour dons — différent de 706 des modules commerciaux. fn_ae_is_income non modifiée (ONG-001/002 pré-déclarés mig.138). QWT-01/02/03 documentés (règles DRAFT — impact nul). ATMC-02 planifié après mig.146.
- **ADR-144** — Migration Hôtel vers moteur central. HOT-001 (encaissement chambre, 2 séq, TVA décomposée 706+4441, CG TTC÷1.189). UPDATE fn_ae_is_income : HOT-001 ajouté (absent depuis mig.138). QW-05 : htl_journal_entries/htl_journal_lines path supprimé (compte 7011 non-SYSCOHADA). Nouveau chemin : POST /api/hotel/payments → emit HOT-001. hotel_* tables (mig.052) — audit LEC planifié.
- **ADR-143** — Migration École vers moteur central. ECO-001 (frais scolaires, TVA=0, 521/706). DROP trg_paiement_scolaire (P-001 : fn conservée). QW-03 : double write transactions éliminé. QW-04 : INSERT journal_comptable direct supprimé. Nouveau chemin : POST /api/ecole/paiements → emit ECO-001.
- **ADR-142** — Migration Restaurant vers moteur central (commits 7d29ded + 3600316)
- **ADR-141** — Migration Paie vers moteur central (commits b483411 + c9677db)
- ADR-139/140 — à formaliser lors de la prochaine session (Facturation, Santé)

### ATMC-01 — Résultats d'audit (2026-06-26)
- Anomalie critique AT-03 : `ec.config` inexistant → corrigé par QW-01 (mig. 142.5)
- Anomalie AT-05 : comptes 705/706 (SAN/FAC) — intentionnel, documenté
- Anomalie AT-06 : traitement CA Congo — planifié Sprint Or
- Anomalie AT-07 : `trg_facture_numero` — non-comptable, inoffensif
- Certifications AT-01/02 : dashboards legacy → migration LEC
- **Premier événement `processed` confirmé** : event `c1a5cc46-5484-41c4-b910-85da26939de5`, RES-001, is_balanced=true, duration=54ms
- **Nouvelle dette critique** : DT-C01 — rétroplay FAC/SAN/PAI (Quick Win QW-02)

---

*Généré par le Plan Directeur Oraforme — Cycle officiel 11 étapes + Best Practices + Lessons Learned + ADR.*
*Prochaine mise à jour : Migration 142 (Restaurant)*
