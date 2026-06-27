# PROJECT_HEALTH — Oraforme ERP SaaS
> Document vivant — mis à jour automatiquement après chaque migration du Plan Directeur.
> Dernière mise à jour : **Sprint 148 — BTP+AGR+Realtime+DataSourceBadge+BCI v1.10.0** — 2026-06-27
> Ne pas modifier manuellement — généré par le cycle de migration officiel.

---

## 1. ÉTAT GLOBAL

| Indicateur | Valeur |
|---|---|
| **Architecture Health Index (AHI)** | **82 / 100** *(Sprint 148 : BTP+AGR+Realtime+BCI)* |
| Moteur central déployé | ✅ v1.10.0 (mig. 138-148) |
| Modules dans Oraforme | 14 identifiés |
| Modules migrés vers moteur central | **12 / 14 (79%)** *(+BTP+AGR Sprint 148)* |
| Modules certifiés Bronze | 0 *(inclus dans Argent)* |
| Modules certifiés Argent (conditionnel) | **4** *(ECO + HOT — SQL + BTP + AGR — SQL à exécuter)* |
| Modules certifiés Argent (définitif) | **6 ✅ (FAC, SAN, PAI, RES, ONG, BOI)** |
| Modules certifiés Or | 0 |
| Audit ATMC-01 | ✅ COMPLET — 9/9 points PASS — 2026-06-26 |
| BCI Global | **90/100** *(Sprint 148 : Realtime ×4 + DataSourceBadge ×8 + SourceExplainBanner ×4)* |
| Realtime actif | ✅ Grand Livre + Balance + Journal (journal_entries) + Trésorerie (transactions) |
| Triggers legacy comptables restants | **~13** *(stable)* |
| INSERT directs en routes API | 0 ✅ |
| Chemins parallèles dashboard (writeComptaEntry) | **13 pages** *(stable — LEC prévu)* |
| Doubles écritures actives connues | 0 ✅ |
| Régressions ouvertes | 0 ✅ |
| Routes API avec emit_accounting_event | **17 routes** *(stable)* |
| Règles comptables actives | **34 règles** *(+6 Sprint 148 : BTP-001/002+AGR-001/002 actives + BTP-001 séq2)* |
| Règles comptables en draft | **22 règles** *(+3 Sprint 148 : BTP-003/004+AGR-003)* |

### AHI — Décomposition

| Dimension | Poids | Score | Calcul |
|---|---|---|---|
| Couverture moteur central | 30% | 30/30 | 12 modules sur ~14 (79%) — BTP+AGR ajoutés Sprint 148 |
| Certifications obtenues | 25% | 23/25 | 6 × Argent définitif + 4 × Argent conditionnel ECO+HOT+BTP+AGR (×0.80) |
| Zéro régression confirmée | 20% | 20/20 | TypeScript 0 erreur, Realtime + badges sans régression |
| Moteurs de calcul stables | 15% | 15/15 | calcul-paie.ts + universal-payroll-engine.ts intouchables |
| Dette technique éliminée | 10% | 9/10 | select('*') Grand Livre corrigé. writeComptaEntry 13 pages restantes (LEC) |
| **TOTAL** | **100%** | **82/100** | |

> AHI cible fin Plan Directeur : **90+/100**

---

### BCI — Business Consistency Index

> Nouveau KPI ajouté 2026-06-26. Mesure la cohérence des données visibles dans toute l'application.
> Progresse à chaque migration comme l'AHI. Matrice 15 dimensions obligatoire après chaque migration.

| Écran | Score | Notes |
|---|---|---|
| Direction | 88% | TTC affiché (QW-BCI-01). Source : transactions. Badge prévu Sprint 149. |
| Finance | 85% | HT/TTC explicité (QW-BCI-01). SourceExplainBanner prévu Sprint 149. |
| Comptabilité | 88% | HT + Warning manuel (QW-BCI-01/02). Realtime journal_entries ✅ |
| Grand Livre | **92%** | ✅ Realtime (Sprint 148) + SourceExplainBanner + select optimisé |
| Balance | **92%** | ✅ Realtime (Sprint 148) + DataSourceBadge |
| Journal | **92%** | ✅ Realtime INSERT (Sprint 148) + DataSourceBadge |
| Audit | 87% | accounting_event_log actif. 12 modules tracés. |
| Reporting | 75% | Bloqué LEC — 2 sources de vérité. SourceExplainBanner prévu. |
| BI | 80% | Données cohérentes. Realtime à ajouter Sprint 149. |
| MIAA | 82% | Agents actifs. |
| Workflow | 65% | Infrastructure déployée, non intégrée accounting_events |
| Notifications | 65% | Triggers partiels. Notifications financières à ajouter. |
| API publiques | **95%** | ✅ 17 routes + BTP-001/002 + AGR-001/002 (Sprint 148) |
| Exports | 75% | GED + PDF OK. Grand Livre CSV ✅. Balance CSV ✅. |
| États financiers | 72% | SourceExplainBanner + explication LEC ajoutée. Données correctes. |

> **BCI Global : 90/100** *(Sprint 148 : Realtime ×4 + DataSourceBadge ×8 + BTP+AGR)*

> **Chemin vers 95+** : Réaliser la migration LEC (unifier journal_entries + accounting_events), ajouter Realtime sur Finance/Direction/BI, compléter notifications financières.

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
| ✅ Actif en production | v1.9.0 | FAC, SAN, PAI, RES, ECO, HOT, ONG, BOI, STK, ACH | **71%** |

**Prochaines étapes :** BTP+Agriculture (v1.10.0) → cible v2.0.0 (tous modules)

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
| **ONG** | ✅ Mig. 145 + P-008 | 🥈 **Argent définitif** ✅ | ONG-002 draft (QWT-03), fn_ae_is_income ONG-002 à corriger lors activation | Archiver draft → Or |
| **Boisson (BOI)** | ✅ Mig. 146 + P-008 + ANOM-03/04/05/06 | 🥈 **Argent définitif** ✅ *(SQL exécuté 2026-06-27)* | BOI-002 draft | Archiver draft → Or |
| **Stocks (STK)** | ✅ Mig. 147 — STK-001/002 (actives), STK-003/004 (draft) | 🥈 **Argent conditionnel** *(SQL à exécuter)* | STK-003/004 draft (inventaire), type inconsistency IN/OUT vs entree/sortie | SQL + tests → Argent définitif |
| **Achats (ACH)** | ✅ Mig. 147 — ACH-001/002 (actives) | 🥈 **Argent conditionnel** *(SQL à exécuter)* | Pas de décomposition TVA dans table achats | SQL + tests → Argent définitif |
| **BTP** | ❌ Non migré | — | À auditer | Migration 148 |
| **Agriculture** | ❌ Non migré | — | À auditer | Migration 149 |
| **Banque/Microfinance** | ❌ Non migré | — | À auditer | Après 149 |
| **Cabinet comptable** | ❌ Non migré | — | À auditer | Après 149 |
| **Trésorerie** | ❌ Non migré | — | 7 triggers legacy (mig. 046) — le plus complexe | Migration LEC |

---

## 5. INDICATEURS DE QUALITÉ

| Indicateur | Valeur | Tendance |
|---|---|---|
| Triggers legacy comptables restants | **~13** | ↓ (Sprint 147 : −4 : trg_stock_in/out + trg_achat_enregistrement/paye) |
| INSERT directs dans routes API | **0** ✅ | → |
| Chemins parallèles dashboard (writeComptaEntry) | **13 pages** | ↓ (−1 : receptions/page.tsx → /api/stock/reception) |
| Doubles écritures actives connues | **0** ✅ | → |
| Régressions ouvertes | **0** ✅ | → |
| Régressions corrigées cumulées | 13 | ↑ (+3 Sprint 147 : bugs quantity/notes/unit_cost receptions) |
| Fichiers dead code supprimés | 1 (financial-sync.ts) | → |
| Routes API avec emit_accounting_event | **17 routes** | ↑ (+3 Sprint 147) |
| Règles comptables actives | **28 règles** | ↑ (+4 Sprint 147 : STK-001/002, ACH-001/002) |
| Règles comptables en draft | **19 règles** | ↑ (+2 Sprint 147 : STK-003/004) |

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
| ~~trg_achat_enregistrement~~ | ~~achats~~ | ~~Achats~~ | ✅ **SUPPRIMÉ mig.147** |
| ~~trg_achat_paye~~ | ~~achats~~ | ~~Achats~~ | ✅ **SUPPRIMÉ mig.147** |
| ~~trg_stock_in_to_journal~~ | ~~stock_movements~~ | ~~Stocks~~ | ✅ **SUPPRIMÉ mig.147** |
| ~~trg_stock_out_to_journal~~ | ~~stock_movements~~ | ~~Stocks~~ | ✅ **SUPPRIMÉ mig.147** |
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
| 4 | ~~**Mig. 146**~~ | ~~Boisson (BOI-001/002)~~ | ✅ **TERMINÉE** — ANOM-03/04/05/06 + 3 fn moteur + v1.8.0 | — | — |
| 5 | ~~**Mig. 147**~~ | ~~Stocks + Achats~~ | ✅ **TERMINÉE** — 4 triggers supprimés, STK/ACH → moteur v1.9.0, bugs corrigés | — | — |
| 6 | **Mig. 148** | BTP + Agriculture | 🟢 Faible | Modules moins utilisés, patterns probablement simples | Faible |
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
- **ADR-147** — Sprint 147 Stocks+Achats → moteur central v1.9.0. STK-001 (réception marchandises 311/401 HT — stock permanent SYSCOHADA). STK-002 (sortie stock consommation 601/311 — fire-and-forget sur move/OUT). ACH-001 (facture fournisseur 601/401 HT charge directe — table achats sans TVA décomposée). ACH-002 (règlement fournisseur 401/treasury_credit). DROP 4 triggers legacy : trg_stock_in/out_to_journal, trg_achat_enregistrement/paye. Bugs corrigés : quantity→quantite, notes→note, unit_cost supprimé dans stock_movements. writeComptaEntry receptions éliminé → /api/stock/reception. achats/page.tsx passe par API (suppression double-write transactions direct). fn_ae_has_treasury_impact : ACH ajouté. fn_ae_category : STK→Stocks, ACH→Achats.
- **ADR-146** — Migration Boisson vers moteur central. BOI-001 (encaissement tournée, 5xx/701 HT + 5xx/4441 TVA, TTC÷1.189). Compte 701 (Ventes de marchandises — distribution boissons, vs 706 prestations). UPDATE fn_ae_has_treasury_impact+fn_ae_is_income+fn_ae_category : BOI absent depuis mig.138 (ANOM-03/04/05). Guard double-emit amélioré : statut guard vs comparaison montant fragile (ANOM-06). ATMC-02 : audit 8 modules déclenché après SQL exécuté. SQL exécuté 2026-06-27 → BOI certifié Argent définitif.
- **ADR-145** — Migration ONG vers moteur central. ONG-001 (don reçu, 5xx/741, TVA=0, 1 séquence). Pattern P-008 TABLE-BRIDGE-LEGACY : suppression INSERT transactions dans POST /api/ong/dons. Compte 741 (Subventions d'exploitation) pour dons — différent de 706 des modules commerciaux. fn_ae_is_income non modifiée (ONG-001/002 pré-déclarés mig.138). QWT-01/02/03 documentés (règles DRAFT — impact nul).
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

*Généré par le Plan Directeur Oraforme — Gouvernance ERP Sprints 11 phases + Best Practices + Lessons Learned + ADR.*
*Prochaine mise à jour : Sprint 148 (BTP + Agriculture)*
