# PROJECT_HEALTH — Oraforme ERP SaaS
> Document vivant — mis à jour automatiquement après chaque migration du Plan Directeur.
> Dernière mise à jour : **Migration 142 (Restaurant) — Certification Argent conditionnel** — 2026-06-26
> Ne pas modifier manuellement — généré par le cycle de migration officiel.

---

## 1. ÉTAT GLOBAL

| Indicateur | Valeur |
|---|---|
| **Architecture Health Index (AHI)** | **55 / 100** *(conditionnel — définitif après tests fonctionnels RES)* |
| Moteur central déployé | ✅ v1.4.0 (mig. 138-142) |
| Modules dans Oraforme | 14 identifiés |
| Modules migrés vers moteur central | 4 / 14 (29%) |
| Modules certifiés Bronze | 0 *(inclus dans Argent)* |
| Modules certifiés Argent (conditionnel) | **1 ⏳ (RES)** |
| Modules certifiés Argent (définitif) | **3 ✅ (FAC, SAN, PAI)** |
| Modules certifiés Or | 0 |
| Triggers legacy comptables restants | ~18 *(restaurant n'avait pas de trigger dédié — chemin legacy via transactions supprimé)* |
| INSERT directs en routes API | 0 ✅ |
| Chemins parallèles dashboard | 14 pages (lib/compta-sync-client.ts) |
| Doubles écritures actives connues | 0 ✅ |
| Régressions ouvertes | 0 ✅ |
| Régressions corrigées (cycle actuel) | 1 (dashboard direction migré vers accounting_events) |

### AHI — Décomposition

| Dimension | Poids | Score | Calcul |
|---|---|---|---|
| Couverture moteur central | 30% | 21/30 | 4 modules sur ~13 modules avec écritures |
| Certifications obtenues | 25% | 15/25 | 3 × Argent définitif + 1 × Argent conditionnel (×0.55 coeff) |
| Zéro régression confirmée | 20% | 20/20 | SQL validé en base, aucune régression détectée |
| Moteurs de calcul stables | 15% | 15/15 | calcul-paie.ts + universal-payroll-engine.ts intouchables |
| Dette technique éliminée | 10% | 7/10 | 2 inserts transactions supprimés, dashboard décuplé de transactions |
| **TOTAL** | **100%** | **55/100** *(→ 56 définitif après tests)* | |

> AHI cible fin Plan Directeur : **90+/100**

---

## 2. DETTE TECHNIQUE

### 🔴 Critique

*Aucune dette critique identifiée.*

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
| ✅ Actif en production | v1.4.0 | FAC, SAN, PAI, RES | **29%** |

**Prochaines étapes :** École (v1.5.0), Hôtel (v1.6.0), ONG (v1.7.0), Boisson (v1.8.0) → cible v2.0.0 (tous modules)

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
| **Paie/RH (PAI)** | ✅ Mig. 141 | 🥈 **Argent définitif** ✅ | fn_bulletins_paie_to_journal, PAI-004/005 draft, dual namespace | Archiver drafts → Or |
| **Restaurant (RES)** | ✅ Mig. 142 | 🥈 **Argent conditionnel** ⏳ | RES-003/004 en draft, resto_achats non en base, dashb. migré | Tests fonctionnels → définitif |
| **École (ECO)** | ❌ Non migré | — | trg_paiement_scolaire actif (mig. 031) | Migration 143 |
| **Hôtel (HOT)** | ❌ Non migré | — | htl_journal_entries, triggers hôtel | Migration 144 |
| **ONG** | ❌ Non migré | — | À auditer | Migration 145 |
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
| Triggers legacy comptables restants | ~18 | → (restaurant n'avait pas de trigger dédié) |
| INSERT directs dans routes API | **0** ✅ | ↓↓ (était 2 de plus avant mig. 142) |
| Chemins parallèles dashboard (writeComptaEntry) | **14 pages** | → (stable, en attente LEC) |
| Doubles écritures actives connues | **0** ✅ | → |
| Régressions ouvertes | **0** ✅ | → |
| Régressions corrigées cumulées | 6 | ↑ |
| Fichiers dead code supprimés | 1 (financial-sync.ts) | → |
| Routes API avec emit_accounting_event | 10 routes | ↑ |
| Règles comptables actives | 16 règles | ↑ |
| Règles comptables en draft | 13 règles | ↑ |

### Détail triggers legacy restants

| Trigger | Table | Module | Migration cible |
|---|---|---|---|
| trg_paiement_to_transaction | paiements | Trésorerie | LEC |
| trg_transaction_to_journal | transactions | Trésorerie | LEC |
| trg_auto_journal_entry | multiple | Generic | LEC |
| trg_facture_to_transaction | factures | Facturation | LEC (redondant post-139) |
| trg_paie_to_transaction | bulletins_paie | Paie | À vérifier (redondant post-141?) |
| trg_paiement_scolaire | paiements scolaires | École | 143 |
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
| 1 | **Mig. 143** | École (ECO-001/002) | 🔴 Haute | trg_paiement_scolaire documenté, impact direct sur trésorerie école | Moyenne |
| 2 | **Mig. 144** | Hôtel (HOT-001/002) | 🟠 Moyenne | htl_journal_entries séparé — audit préalable nécessaire | Moyenne |
| 3 | **Mig. 144** | Hôtel (HOT-001/002) | 🟠 Moyenne | htl_journal_entries séparé — audit préalable nécessaire | Moyenne |
| 4 | **Mig. 145** | ONG | 🟠 Moyenne | À auditer — probablement patterns FAC+SAN | Faible |
| 5 | **Mig. 146** | Boisson | 🟠 Moyenne | À auditer | Faible |
| 6 | **Mig. 147** | Stocks + Achats | 🟠 Moyenne | 4 triggers legacy (stock_in/out, achat) — impact transversal | Haute |
| 7 | **Mig. 148** | BTP + Agriculture | 🟢 Faible | Modules moins utilisés, patterns probablement simples | Faible |
| 8 | **Mig. 149** | Banque + Cabinet | 🟢 Faible | Modules spécialisés — audit requis | Haute |
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
- **ADR-142** — Migration Restaurant vers moteur central (commits 7d29ded + 3600316)
- **ADR-141** — Migration Paie vers moteur central (commits b483411 + c9677db)
- ADR-139/140 — à formaliser lors de la prochaine session (Facturation, Santé)

---

*Généré par le Plan Directeur Oraforme — Cycle officiel 11 étapes + Best Practices + Lessons Learned + ADR.*
*Prochaine mise à jour : Migration 142 (Restaurant)*
