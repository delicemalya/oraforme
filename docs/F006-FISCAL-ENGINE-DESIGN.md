# F-006 — FISCAL ENGINE DESIGN
## Design officiel du moteur fiscal Oraforme

---

**Date :** 2026-07-02  
**Statut :** DESIGN OFFICIEL — Aucune implémentation. Aucun code. Aucun SQL.  
**Prérequis validés :** F-005 (FCI=48, CERTIF. REFUSÉE) · F-005.1 (Blueprint) · F-005.2 (FKB)  
**Résultat attendu :** Document de design gouvernant FM-1 → FM-4

---

# PARTIE 0 — FONDEMENTS

## 0.1 — Les 7 Lois Fondamentales (rappel)

```
LOI-1  SINGLE OWNERSHIP
       Chaque calcul fiscal appartient à un seul Engine. Aucun autre composant
       ne calcule, ne journalise, ni ne déclare un montant fiscal.

LOI-2  GRAND LIVRE AS TRUTH
       journal_entries est la seule source de vérité pour toute déclaration,
       tout paiement et tout audit fiscal. Jamais les tables métier (factures,
       bulletins_paie, stocks, commandes).

LOI-3  PURE CALCULATORS
       FiscalCalculationEngine ne lit ni n'écrit en base. Il reçoit des données,
       retourne des résultats. Zéro effets de bord.

LOI-4  IMMUTABLE RULES
       Une FiscalRule ne se modifie jamais. On crée une nouvelle version avec
       effective_from. L'historique fiscal reste intact ad vitam.

LOI-5  SINGLE WRITER
       FiscalJournalEngine est le SEUL composant qui écrit dans journal_entries
       pour les entrées fiscales. Aucun trigger, aucun module métier, aucun
       endpoint ne crée directement une écriture fiscale.

LOI-6  EVENTS AS TRIGGERS
       Toute écriture fiscale est déclenchée par un FiscalEvent émis par
       l'ERP Core. Jamais par un appel direct depuis l'UI ou un cron aveugle.

LOI-7  READ/WRITE SEPARATION
       Engines qui lisent : FiscalRulesEngine, FiscalDeclarationEngine,
       FiscalAuditEngine, FiscalExplanationEngine.
       Engine qui écrit : FiscalJournalEngine (seul).
       Engines purs : FiscalCalculationEngine, FiscalValidationEngine.
       Engines transactionnels : FiscalPaymentEngine (lit + écrit via Journal).
```

## 0.2 — Territoire du Moteur Fiscal

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        FISCAL ENGINE TERRITORY                               ║
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │                         ERP CORE                                    │    ║
║  │  (Factures · Paie · Stocks · Achats · Clôture · RH · ...)         │    ║
║  └────────────────────────────┬────────────────────────────────────────┘    ║
║                               │ FiscalEvent                                  ║
║                               ▼                                              ║
║  ╔═════════════════════════════════════════════════════════════════════╗    ║
║  ║                 FISCAL ENGINE (domaine isolé)                       ║    ║
║  ║                                                                     ║    ║
║  ║  [Rules] → [Calculation] → [Validation] → [Journal]               ║    ║
║  ║                                                ↓                   ║    ║
║  ║                                         journal_entries             ║    ║
║  ║                                                ↓                   ║    ║
║  ║           [Declaration] ←──────────────────────┤                   ║    ║
║  ║           [Payment]     ←──────────────────────┤                   ║    ║
║  ║           [Audit]       ←──────────────────────┤                   ║    ║
║  ║           [Explanation] ←──────────────────────┘                   ║    ║
║  ║                                                                     ║    ║
║  ╚═════════════════════════════════════════════════════════════════════╝    ║
║                               │                                              ║
║                               ▼                                              ║
║  ┌─────────┐  ┌────────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  ║
║  │Accounting│  │   MIAA     │  │ Reporting │  │ Realtime │  │Dashboard │  ║
║  │  Core   │  │  (Chatbot) │  │    BI     │  │ Updates  │  │  KPIs    │  ║
║  └─────────┘  └────────────┘  └───────────┘  └──────────┘  └──────────┘  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## 0.3 — Données fondamentales

### FiscalEvent (entrée universelle du moteur)

```
FiscalEvent {
  id          : UUID          ← identifiant unique de l'événement
  type        : FiscalEventType
  tenant_id   : UUID
  pays        : ISO2
  date        : ISO8601
  source      : EventSource   ← 'invoice' | 'payroll' | 'purchase' | 'stock'
                                 | 'closing' | 'restaurant' | 'health' | 'school'
                                 | 'hotel' | 'ong' | 'agriculture' | 'btp'
  source_id   : UUID          ← id de l'entité source (facture_id, bulletin_id…)
  payload     : Record<string, unknown>  ← données spécifiques au type
  emitted_at  : timestamp
  correlation : UUID          ← lie tous les events d'une même transaction métier
}
```

### FiscalRule (données immuables)

```
FiscalRule {
  id            : UUID
  code          : string       ← 'TVA_CG' | 'IS_CM' | 'CNSS_GA' …
  pays          : ISO2
  impot         : ImpotType
  version       : number       ← autoincrement, jamais modifié
  effective_from: date
  effective_until: date | null ← null = en vigueur
  parametres    : RuleParams   ← taux, plafonds, tranches, bases, écheances
  source_legale : string       ← "LF 2026 Congo, Art. 47"
  created_at    : timestamp
  created_by    : UUID         ← audit trail
}
```

### FiscalCalculation (sortie du Calculation Engine)

```
FiscalCalculation {
  event_id      : UUID
  rule_ids      : UUID[]       ← règles appliquées
  impot         : ImpotType
  base          : number
  taux          : number
  montant       : number
  adjustements  : Adjustment[] ← plafonds, tranches, exonérations
  journal_writes: JournalWrite[]  ← écritures à créer
  errors        : ValidationError[]
  computed_at   : timestamp
}
```

### FiscalJournalEntry (écriture atomique)

```
FiscalJournalEntry {
  id          : UUID
  tenant_id   : UUID
  event_id    : UUID          ← FiscalEvent source
  entry_type  : 'fiscal'
  debit       : string        ← compte SYSCOHADA
  credit      : string
  montant     : number
  libelle     : string
  date        : date
  periode     : {annee, mois}
  pays        : ISO2
  impot       : ImpotType
  source      : string        ← 'fiscal_engine'  ← jamais 'trigger', jamais 'api'
  source_id   : UUID
  immutable   : true          ← jamais modifié après écriture
}
```

---

# PARTIE 1 — LES 8 ENGINES

---

## ENGINE 1 — FISCAL RULES ENGINE

### Responsabilités

```
RE-1  Stocker et gérer toutes les FiscalRule de tous les pays
RE-2  Fournir la règle active pour (pays, impôt, date) — versioning automatique
RE-3  Détecter les conflits de version (deux règles actives pour même clé)
RE-4  Invalider et remplacer une règle (effective_until) sans la supprimer
RE-5  Exposer le catalogue complet des règles pour audit et MIAA
RE-6  Notifier les engines consumers quand une règle change (RuleUpdatedEvent)
RE-7  Valider la cohérence d'une nouvelle règle avant activation
```

### Interface principale

```
FiscalRulesEngine {

  getActiveRule(pays: ISO2, impot: ImpotType, date: Date): FiscalRule | null
  → Règle unique active à la date donnée. null si aucune règle configurée.
  → Throw: RuleConflictError si deux règles actives détectées (ne jamais résoudre
    silencieusement — alerter immédiatement)

  getActiveRules(pays: ISO2, date: Date, impots?: ImpotType[]): FiscalRule[]
  → Toutes les règles actives pour un pays à une date
  → Filtrables par type d'impôt

  getRuleHistory(pays: ISO2, impot: ImpotType): FiscalRule[]
  → Toutes les versions chronologiques d'une règle (audit trail complet)

  getRuleById(id: UUID): FiscalRule
  → Récupération directe par id (immuable — toujours la même règle)

  getCatalog(pays?: ISO2): FiscalRuleCatalog
  → Catalogue complet, filtrable par pays
  → Utilisé par FiscalDeclarationEngine et MIAA

  validateRule(rule: Partial<FiscalRule>): ValidationResult
  → Vérifie cohérence avant activation (taux dans range valide, comptes SYSCOHADA
    existent, dates cohérentes, source légale présente)

  activateRule(rule: FiscalRule): ActivationResult
  → Désactive la version précédente (effective_until = today - 1d)
  → Active la nouvelle version
  → Émet RuleUpdatedEvent

  deactivateRule(ruleId: UUID, reason: string): void
  → Mise en effective_until sans suppression

}
```

### Entrées

```
→ (pays, impot, date)               pour getActiveRule
→ FiscalRule (données + source)      pour activateRule
→ tenant_id                         pour vérifier droits admin
```

### Sorties

```
← FiscalRule | FiscalRule[]         pour les queries
← RuleUpdatedEvent                  vers FiscalEventBus (broadcast)
← ValidationResult                  pour pré-validation
← ActivationResult { success, previous_version, new_version, effective_from }
```

### Events émis

```
RULE_ACTIVATED    { rule_id, pays, impot, effective_from, previous_id }
RULE_DEACTIVATED  { rule_id, pays, impot, reason, effective_until }
RULE_CONFLICT     { pays, impot, conflicting_ids[] }  → alerte critique
CATALOG_UPDATED   { pays, changed_impots[] }
```

### Realtime

```
Canal : fiscal:rules:{pays}
Push sur RULE_ACTIVATED → mise à jour cache Rules dans FiscalCalculationEngine
Push sur RULE_CONFLICT  → alerte Ops immédiate (jamais silencieuse)
```

### Versioning

```
Stratégie : Immutable versioning
- Une règle est créée une fois, jamais modifiée
- Nouvelle LF → nouvelle règle v2 avec effective_from = date_vigueur
- FiscalCalculationEngine utilise getActiveRule(pays, impot, date_event)
  → même écriture de 2018 = calculée avec la règle de 2018 (pas la règle 2026)
  → Reconstruction historique parfaite
```

### Tests

```
TEST-RE-001  getActiveRule retourne null si aucune règle (pas d'erreur)
TEST-RE-002  getActiveRule retourne la version correcte selon la date
TEST-RE-003  RuleConflictError si deux versions actives simultanées
TEST-RE-004  activateRule désactive automatiquement la version précédente
TEST-RE-005  getRuleHistory retourne toutes versions chronologiques
TEST-RE-006  validateRule rejette un taux > 100% ou un compte inexistant
TEST-RE-007  Règle abolie (TUS_FISCALE_CG) retourne taux=0 après LF 2026
TEST-RE-008  getActiveRules filtre correctement par pays ET date
```

### Consumers

```
→ FiscalCalculationEngine  (getActiveRule — avant chaque calcul)
→ FiscalDeclarationEngine  (getCatalog — pour construire les formulaires)
→ FiscalAuditEngine        (getActiveRule — pour vérifier cohérence)
→ FiscalExplanationEngine  (getCatalog, getRuleHistory — pour expliquer à MIAA)
→ Admin UI                 (catalogue complet, validation avant activation)
```

### ERP Core

```
L'ERP Core ne lit jamais les règles directement.
Il émet des FiscalEvents → FiscalRulesEngine est appelé par le pipeline.
```

### Accounting Core

```
Accounting Core ne consomme pas le Rules Engine directement.
Il reçoit des FiscalJournalEntry déjà calculées.
```

### MIAA

```
MIAA interroge getCatalog() et getRuleHistory() pour répondre aux questions :
"Quel est le taux de TVA au Congo ?"
"Depuis quand l'IS existe-t-il au Congo ?"
"Quelle règle CNSS a été appliquée sur ce bulletin de novembre 2024 ?"
```

---

## ENGINE 2 — FISCAL CALCULATION ENGINE

### Responsabilités

```
CA-1  Calculer les montants fiscaux à partir d'une FiscalRule et de données brutes
CA-2  Être une fonction PURE : même entrée → même sortie, zéro effets de bord
CA-3  Gérer tranches IRPP, plafonds CNSS, minimums IS, formules TVA+CA
CA-4  Retourner les écritures comptables à créer (journal_writes)
CA-5  Signaler les erreurs de calcul sans les corriger silencieusement
CA-6  Supporter le calcul multi-impôt sur un même événement
CA-7  Permettre le recalcul à des fins d'audit (rejouer l'histoire)
```

### Interface principale

```
FiscalCalculationEngine {

  calculate(event: FiscalEvent, rules: FiscalRule[]): FiscalCalculation
  → Point d'entrée universel
  → Sélectionne le sous-calculateur selon rule.impot
  → Retourne FiscalCalculation avec journal_writes

  calculateTVA(params: TVAParams, rule: FiscalRule): TVAResult
  → { base_ht, tva, centimes_add, ttc, journal_writes }
  → Calcul pur, aucun accès DB

  calculateIRPP(params: IRPPParams, rule: FiscalRule): IRPPResult
  → { base_imposable, tranches[], irpp, journal_writes }
  → Applique les tranches du barème national

  calculateCNSS(params: CNSSParams, rule: FiscalRule): CNSSResult
  → { branches[], total_salarie, total_patronal, journal_writes }
  → Applique plafonds par branche

  calculateIS(params: ISParams, rule: FiscalRule): ISResult
  → { resultat_avant_is, is_theorique, minimum_perception, is_du, journal_writes }
  → max(theorique, minimum) selon LOI-3 (pur, pas de DB)

  calculatePatente(params: PatenteParams, rule: FiscalRule): PatenteResult
  → { tranche, base, patente, camu, centimes_add, total, journal_writes }

  calculateRAS(params: RASParams, rule: FiscalRule): RASResult
  → { brut, taux, ras, net, journal_writes }

  replay(eventId: UUID, ruleVersion: number): FiscalCalculation
  → Recalcule avec une version de règle historique (audit/litige)
  → Lit l'event depuis l'EventStore (pas la DB métier)

  preview(event: FiscalEvent, rules: FiscalRule[]): FiscalCalculationPreview
  → Même que calculate() mais sans journalisation (pour UI preview)

}
```

### TVAParams (exemple de structure d'entrée)

```
TVAParams {
  montant_ht    : number
  nature        : 'vente_bien' | 'prestation_service' | 'exportation' | 'importation'
  client_type   : 'assujetti' | 'non_assujetti' | 'exporte'
  exceptions    : string[]    ← ['zone_franche', 'produit_exonere']
}

IRPPParams {
  salaire_brut    : number
  cnss_deductible : number    ← CNSS salarié (déductible de la base IRPP)
  avantages_nature: number
  charges_famille : number    ← selon pays (déductions familiales)
}

CNSSParams {
  salaire_brut    : number
  periode         : {annee, mois}
  type_contrat    : 'cdi' | 'cdd' | 'apprenti'
}

ISParams {
  resultat_avant_is : number  ← depuis genererCompteResultat()
  ca_ht_annuel      : number  ← depuis journal_entries classe 7
  exercice          : number
  avances_versees   : number  ← Σ avances T1-T4 déjà comptabilisées
  regime_special    : string | null ← 'zone_franche' | 'petrolier' | null
}
```

### Sorties

```
FiscalCalculation {
  event_id      : UUID
  rule_ids      : UUID[]
  impot         : ImpotType
  base          : number
  taux          : number
  montant       : number
  adjustements  : [{ type, description, impact }]
  journal_writes: [{ debit, credit, montant, libelle, impot }]
  errors        : []          ← vide si calcul ok
  computed_at   : timestamp
}
```

### Events émis

```
CALCULATION_COMPLETED   { event_id, impot, montant, rule_id }
CALCULATION_ERROR       { event_id, impot, error_code, details }
CALCULATION_ZERO_ALERT  { event_id, impot }  ← montant = 0 sur base > 0
MINIMUM_PERCEPTION_APPLIED { event_id, theorique, minimum, is_du } ← IS
```

### Realtime

```
Aucun push Realtime propre — résultats transmis via Pipeline.
FiscalValidationEngine décide du push après validation.
```

### Versioning

```
Stratégie : Deterministic replay
- calculate(event, rule) est déterministe
- Replay historique : même event + même rule_version → même résultat
- Aucun paramètre global mutable (pas de "taux courant" en cache statique)
```

### Tests

```
TEST-CA-001  TVA CG : 1,000,000 HT → tva=180,000, ca=9,000, ttc=1,189,000
TEST-CA-002  TVA CM : 1,000,000 HT → tva=175,000 (PAS 192,500)
TEST-CA-003  TVA exportation → tva=0 (taux zéro)
TEST-CA-004  IRPP CG : brut=500,000, cnss=20,000 → base=480,000 → irpp=4,133
TEST-CA-005  CNSS CG plafond VID : brut=2,000,000 → base_vid=1,200,000
TEST-CA-006  CNSS CG plafond AF  : brut=1,000,000 → base_af=600,000
TEST-CA-007  IS CG : résultat=10M, ca=60M → is_du=max(3M,600K)=3,000,000
TEST-CA-008  IS CG minimum : résultat=-1M, ca=10M → is_du=100,000 (minimum 1%)
TEST-CA-009  TUS CG 2026 → tus=0 (abolie LF 2026)
TEST-CA-010  TUS CG 2025 → tus=salaire×0.045 (règle historique)
TEST-CA-011  journal_writes bien générés pour chaque calcul
TEST-CA-012  Calcul idempotent : même params → même résultat
```

### Consumers

```
→ FiscalValidationEngine  (reçoit FiscalCalculation pour valider)
→ FiscalJournalEngine     (reçoit journal_writes pour écrire)
→ UI Preview              (calculate() en mode preview)
→ FiscalAuditEngine       (replay() pour vérification a posteriori)
→ FiscalExplanationEngine (calculate() pour expliquer les calculs à MIAA)
```

### ERP Core / Accounting Core / MIAA

```
ERP Core      : n'appelle jamais le Calculation Engine directement.
                Il passe par le FiscalEventBus.
Accounting Core: reçoit les écritures finales (après Journal Engine).
MIAA          : peut appeler preview() pour des simulations "combien vais-je payer ?"
```

---

## ENGINE 3 — FISCAL VALIDATION ENGINE

### Responsabilités

```
VA-1  Valider une FiscalCalculation avant autorisation d'écriture Journal
VA-2  Vérifier la cohérence des montants (pas de négatif impossible, pas de zéro suspect)
VA-3  Vérifier que les comptes SYSCOHADA dans journal_writes existent et sont actifs
VA-4  Vérifier les règles métier : SMIG, plafonds, taux valides pour le pays
VA-5  Vérifier les doublons : un FiscalEvent ne peut générer qu'UNE écriture par impôt
VA-6  Bloquer, jamais corriger silencieusement
VA-7  Retourner un rapport de validation complet avec codes d'erreur
```

### Interface principale

```
FiscalValidationEngine {

  validate(calc: FiscalCalculation, context: ValidationContext): ValidationReport
  → Validation complète avant écriture Journal
  → PASS ou FAIL avec liste des violations

  validatePreJournal(writes: JournalWrite[], tenant_id: UUID): PreJournalReport
  → Vérifie comptes, doublons, équilibre débit/crédit

  validateSMIG(salaire_brut: number, pays: ISO2, date: Date): SMIGCheck
  → Retourne { conforme, smig_actuel, ecart } — jamais bloque la paie, alerte seulement

  validateDeclaration(decl: FiscalDeclaration): DeclarationValidationReport
  → Vérifie cohérence déclaration vs journal avant dépôt

  isDuplicate(event_id: UUID, impot: ImpotType, tenant_id: UUID): boolean
  → Vrai si l'event a déjà généré une écriture pour cet impôt

}
```

### ValidationContext

```
ValidationContext {
  tenant_id    : UUID
  pays         : ISO2
  date         : Date
  source_event : FiscalEvent
  rules        : FiscalRule[]   ← règles utilisées pour le calcul
  existing_entries_count: number  ← pour vérif doublon
}
```

### ValidationReport

```
ValidationReport {
  status        : 'PASS' | 'FAIL' | 'WARN'
  violations    : ValidationViolation[]
  warnings      : ValidationWarning[]
  approved_at   : timestamp | null
  blocked_reason: string | null
}

ValidationViolation {
  code      : string     ← 'DUPLICATE_EVENT' | 'INVALID_ACCOUNT' | 'NEGATIVE_TAX'
                            | 'ZERO_ON_NON_ZERO_BASE' | 'UNBALANCED_ENTRY'
  severity  : 'CRITICAL' | 'MAJOR'
  message   : string
  field     : string
  expected  : unknown
  actual    : unknown
}
```

### Codes d'erreur standard

```
VAL-001  DUPLICATE_EVENT        Event déjà traité pour cet impôt
VAL-002  INVALID_ACCOUNT        Compte SYSCOHADA inexistant ou inactif
VAL-003  UNBALANCED_ENTRY       Σ débits ≠ Σ crédits dans journal_writes
VAL-004  NEGATIVE_TAX           Montant fiscal < 0 (impossible sauf avoir)
VAL-005  ZERO_ON_BASE           Montant = 0 sur base > 0 sans exonération
VAL-006  MISSING_RULE           Aucune FiscalRule active trouvée
VAL-007  SMIG_VIOLATION         Salaire < SMIG (warning, pas blocage)
VAL-008  RATE_OUT_OF_RANGE      Taux calculé hors des bornes connues
VAL-009  PLAFOND_EXCEEDED       Base dépasse le plafond déclaré dans la règle
VAL-010  ABOLISHED_TAX_APPLIED  Taxe abolie utilisée avec montant > 0
```

### Events émis

```
VALIDATION_PASSED   { event_id, impot, calc_id }
VALIDATION_FAILED   { event_id, impot, violations[], calc_id }
VALIDATION_WARNING  { event_id, impot, warnings[], calc_id }
SMIG_ALERT          { tenant_id, employe_id, salaire, smig, ecart }
```

### Realtime

```
Canal : fiscal:alerts:{tenant_id}
Push sur VALIDATION_FAILED → alerte immédiate admin + dashboard
Push sur SMIG_ALERT → alerte RH
```

### Tests

```
TEST-VA-001  Doublon détecté : même event_id + même impôt → FAIL VAL-001
TEST-VA-002  Compte 9999 (inexistant) dans journal_write → FAIL VAL-002
TEST-VA-003  Σ débits ≠ Σ crédits → FAIL VAL-003
TEST-VA-004  TVA = 0 sur base = 1,000,000 sans exonération → WARN VAL-005
TEST-VA-005  TUS Fiscale > 0 après 2026-01-01 → FAIL VAL-010
TEST-VA-006  Salaire < SMIG → WARN VAL-007 (pas blocage)
TEST-VA-007  ValidationReport.status = PASS si aucune violation CRITICAL ou MAJOR
TEST-VA-008  validate() est idempotent (même entrée → même rapport)
```

### Consumers

```
→ FiscalJournalEngine  (reçoit ValidationReport — n'écrit que si PASS)
→ FiscalDeclarationEngine (validateDeclaration avant dépôt)
→ Dashboard Admin      (VALIDATION_FAILED → affichage alerte)
→ FiscalAuditEngine    (peut re-valider des calculs historiques)
```

---

## ENGINE 4 — FISCAL JOURNAL ENGINE

### Responsabilités

```
JO-1  Être le SEUL writer pour les entrées fiscales dans journal_entries
JO-2  N'accepter une écriture que si ValidationReport.status = 'PASS'
JO-3  Écrire atomiquement (toutes les entrées d'un même calcul ou aucune)
JO-4  Marquer chaque entrée avec source='fiscal_engine' et event_id
JO-5  Garantir l'immutabilité des entrées écrites (jamais UPDATE ni DELETE)
JO-6  Exposer des reads optimisés pour FiscalDeclarationEngine
JO-7  Maintenir un index par (tenant_id, pays, impot, periode)
JO-8  Notifier Accounting Core après chaque écriture
```

### Interface principale

```
FiscalJournalEngine {

  write(calc: FiscalCalculation, validation: ValidationReport): WriteResult
  → Écrit atomiquement si validation.status = 'PASS'
  → Retourne ids des entrées créées
  → Throw: JournalWriteBlockedError si validation.status ≠ 'PASS'

  writeBatch(calcs: FiscalCalculation[], validation: ValidationReport[]): BatchWriteResult
  → Pour événements générant plusieurs impôts (ex: SALARY_PAID → CNSS + IRPP)
  → Atomique sur le batch entier

  readByPeriode(params: JournalReadParams): JournalEntry[]
  → SELECT optimisé pour FiscalDeclarationEngine
  → Filtres: tenant_id, pays, impot, période, compte

  sumByCompte(params: JournalSumParams): CompteBalance[]
  → Σ débits et Σ crédits par compte pour une période
  → Résultat direct pour remplir les déclarations

  getEntry(id: UUID): JournalEntry
  → Récupération par id (immuable)

  getByEventId(event_id: UUID): JournalEntry[]
  → Toutes les entrées liées à un FiscalEvent

}
```

### JournalReadParams

```
JournalReadParams {
  tenant_id   : UUID
  pays        : ISO2
  impot?      : ImpotType
  compte?     : string      ← ex: '4441' pour TVA collectée
  periode     : { annee: number, mois?: number }  ← mois optionnel pour annuel
  date_debut? : Date
  date_fin?   : Date
  source?     : 'fiscal_engine'  ← filter de sécurité
}
```

### WriteResult

```
WriteResult {
  success       : boolean
  entry_ids     : UUID[]
  event_id      : UUID
  written_at    : timestamp
  accounting_notified: boolean
}
```

### Events émis

```
JOURNAL_WRITTEN        { entry_ids[], event_id, impot, tenant_id }
JOURNAL_WRITE_BLOCKED  { event_id, reason, validation_report }
ACCOUNTING_NOTIFIED    { entry_ids[], tenant_id }
```

### Realtime

```
Canal : fiscal:journal:{tenant_id}
Push sur JOURNAL_WRITTEN → mise à jour compteurs déclaration
Push sur JOURNAL_WRITE_BLOCKED → alerte critique
```

### Versioning / Immutabilité

```
Stratégie : Append-only
- AUCUN UPDATE ni DELETE dans journal_entries pour les entrées fiscales
- Pour corriger une erreur : écriture d'extourne (écriture inverse)
  → signée par l'admin, avec reference_extourne = entry_id original
  → l'erreur reste visible dans l'historique (non effacée)
- Jamais de correction silencieuse
```

### Tests

```
TEST-JO-001  write() bloqué si validation.status = 'FAIL'
TEST-JO-002  write() atomique : si une entrée échoue, toutes rollback
TEST-JO-003  Entrée créée avec source='fiscal_engine' uniquement
TEST-JO-004  getByEventId retourne toutes les entrées du même event
TEST-JO-005  sumByCompte retourne les bons totaux par période
TEST-JO-006  Aucun UPDATE possible sur une entrée fiscale existante
TEST-JO-007  writeBatch atomique sur un SALARY_PAID (CNSS + IRPP ensemble)
TEST-JO-008  Accounting Core notifié après chaque write réussi
```

### Consumers

```
→ FiscalDeclarationEngine (readByPeriode, sumByCompte — source principale)
→ FiscalAuditEngine       (readByPeriode — vérification cohérence)
→ FiscalPaymentEngine     (readByPeriode — calcul solde à payer)
→ Accounting Core         (JOURNAL_WRITTEN → integration Grand Livre global)
→ MIAA                    (getByEventId — traçabilité réponses)
```

### ERP Core

```
L'ERP Core NE DOIT JAMAIS appeler FiscalJournalEngine directement.
Toute écriture passe par le pipeline : Event → Rules → Calculation → Validation → Journal.
```

---

## ENGINE 5 — FISCAL DECLARATION ENGINE

### Responsabilités

```
DE-1  Construire toutes les déclarations fiscales en lisant UNIQUEMENT journal_entries
DE-2  Jamais lire factures, bulletins_paie, commandes ou autres tables métier
DE-3  Pré-remplir les formulaires officiels (DGI, CNSS, Patente...)
DE-4  Persister les déclarations dans leur table dédiée
DE-5  Gérer les statuts de déclaration (a_faire → deposee → payee → en_retard)
DE-6  Calculer et alerter sur les échéances
DE-7  Permettre la génération PDF des formulaires officiels
DE-8  Réconcilier automatiquement déclaration vs journal (avant dépôt)
```

### Interface principale

```
FiscalDeclarationEngine {

  preRemplir(params: DeclarationParams): DeclarationDraft
  → Lit journal_entries via FiscalJournalEngine.sumByCompte()
  → Construit le draft selon le formulaire officiel du pays
  → Source traçable : chaque ligne pointe vers le compte GL source

  deposer(draft: DeclarationDraft, metadata: DepositMetadata): DeclarationResult
  → Valide via FiscalValidationEngine.validateDeclaration()
  → Persiste dans la table de déclaration appropriée
  → Émet DECLARATION_FILED

  getDeclaration(params: GetDeclarationParams): FiscalDeclaration | null

  listDeclarations(tenant_id: UUID, annee: number): DeclarationSummary[]
  → Toutes les déclarations avec statut, montant, échéance

  getEcheances(tenant_id: UUID, pays: ISO2): Echeance[]
  → Prochaines échéances avec jours restants et montant estimé

  reconcilier(decl_id: UUID): ReconciliationReport
  → Compare déclaration déposée vs journal actuel
  → Détecte les écarts post-dépôt (corrections de bulletins, avoirs…)

  genererPDF(decl_id: UUID): PDFBuffer
  → Génère le formulaire officiel rempli

}
```

### DeclarationParams

```
DeclarationParams {
  tenant_id : UUID
  type      : 'tva' | 'cnss' | 'irpp' | 'is' | 'patente' | 'ras'
  pays      : ISO2
  periode   : { annee: number, mois?: number, trimestre?: number }
}
```

### DeclarationDraft (exemple TVA CG)

```
DeclarationDraft {
  type      : 'tva_mensuelle'
  pays      : 'CG'
  periode   : { annee: 2026, mois: 6 }
  lignes    : {
    l1_tva_collectee  : { montant: 180000, source: 'journal_entries', compte: '4441' }
    l2_tva_deductible : { montant: 0,      source: 'journal_entries', compte: '4445' }
    l3_centimes_add   : { montant: 9000,   source: 'journal_entries', compte: '4441-CA' }
    l4_tva_nette      : { montant: 180000, calcul: 'l1-l2' }
    l6_total_a_payer  : { montant: 189000, calcul: 'l4+l3' }
  }
  source    : 'journal_entries'  ← jamais 'factures'
  generated_at : timestamp
  warnings  : []
}
```

### Events émis

```
DECLARATION_DRAFT_READY { tenant_id, type, periode, montant }
DECLARATION_FILED       { tenant_id, type, periode, decl_id, montant }
DECLARATION_OVERDUE     { tenant_id, type, periode, jours_retard, penalite_estimee }
RECONCILIATION_ALERT    { decl_id, ecart, details }
ECHEANCE_REMINDER       { tenant_id, type, date_echeance, jours_restants }
```

### Realtime

```
Canal : fiscal:declarations:{tenant_id}
Push sur DECLARATION_FILED   → mise à jour dashboard statuts
Push sur DECLARATION_OVERDUE → alerte rouge dashboard + email admin
Push sur ECHEANCE_REMINDER   → notification J-15, J-7, J-3, J-1
```

### Versioning

```
Stratégie : Snapshot immutable
- Une déclaration déposée est figée (statut 'deposee')
- Si rectification nécessaire : nouvelle déclaration rectificative
  type='rectificative', reference_originale=decl_id
- L'historique des déclarations est complet et immuable
```

### Tests

```
TEST-DE-001  preRemplir lit UNIQUEMENT journal_entries (mock DB métier retourne vide)
TEST-DE-002  TVA CG : l3_centimes = l1 × 0.05 ± 1 FCFA
TEST-DE-003  IRPP : l9_tus = 0 pour pays='CG' date >= 2026-01-01
TEST-DE-004  CNSS : totaux = Σ entrées 431 du mois
TEST-DE-005  deposer bloqué si réconciliation détecte écart > seuil
TEST-DE-006  getEcheances retourne J+20 pour TVA CG, J+15 pour CNSS CG
TEST-DE-007  DECLARATION_OVERDUE émis si date > échéance sans dépôt
TEST-DE-008  Déclaration rectificative liée à l'originale
```

### Consumers

```
→ UI Déclarations        (preRemplir → afficher le formulaire pré-rempli)
→ FiscalPaymentEngine    (getDeclaration → montant à payer)
→ FiscalAuditEngine      (reconcilier → vérification post-dépôt)
→ MIAA                   (getDeclaration → répondre aux questions)
→ Export / Comptable     (genererPDF → formulaire officiel)
```

---

## ENGINE 6 — FISCAL PAYMENT ENGINE

### Responsabilités

```
PA-1  Enregistrer et tracer le paiement effectif de chaque impôt
PA-2  Vérifier que le montant à payer correspond au solde journal_entries
PA-3  Déléguer l'écriture Journal à FiscalJournalEngine (441 D / 52x C)
PA-4  Mettre à jour le statut de la déclaration associée
PA-5  Calculer et enregistrer les pénalités de retard
PA-6  Émettre les reçus de paiement
PA-7  Détecter les paiements partiels et gérer le solde résiduel
PA-8  Alerter sur les paiements en attente
```

### Interface principale

```
FiscalPaymentEngine {

  initierPaiement(params: PaymentParams): PaymentIntent
  → Calcule le montant exact depuis journal_entries (compte 441-xxx)
  → Vérifie cohérence avec déclaration déposée
  → Retourne un PaymentIntent (non confirmé)

  confirmerPaiement(intent_id: UUID, bankRef: BankReference): PaymentResult
  → Exécute : FiscalJournalEngine.write(441 D, 52x C)
  → Met à jour déclaration.statut = 'payee'
  → Émet TAX_PAID

  calculerPénalités(decl_id: UUID, date_paiement: Date): PénalitéResult
  → Calcule majorations + intérêts moratoires selon règle pays

  getPaiementsEnAttente(tenant_id: UUID): PaiementEnAttente[]
  → Déclarations déposées non payées, avec montant + échéance + pénalités

  getHistoriquePaiements(tenant_id: UUID, annee: number): PaiementHistorique[]

  validerRéférence(bankRef: string, tenant_id: UUID): RéférenceValidation
  → Vérifie que la référence bancaire est unique et non déjà utilisée

}
```

### PaymentParams

```
PaymentParams {
  tenant_id       : UUID
  decl_id         : UUID           ← déclaration à payer
  type            : ImpotType
  compte_debit    : string          ← ex: '521001' (compte bancaire)
  date_valeur     : Date
  reference_banque: string
  montant_paye    : number          ← peut différer du montant_du (paiement partiel)
}
```

### PaymentResult

```
PaymentResult {
  success          : boolean
  payment_id       : UUID
  entry_ids        : UUID[]         ← écritures Journal créées
  montant_paye     : number
  solde_residuel   : number         ← 0 si paiement total
  penalites_incluses: number
  status           : 'complet' | 'partiel' | 'echec'
  receipt_url      : string
}
```

### Events émis

```
TAX_PAID           { tenant_id, type, decl_id, montant, date, reference }
PARTIAL_PAYMENT    { tenant_id, type, decl_id, paye, residuel }
PENALTY_APPLIED    { tenant_id, type, decl_id, penalite, jours_retard }
PAYMENT_FAILED     { tenant_id, type, decl_id, reason }
```

### Realtime

```
Canal : fiscal:payments:{tenant_id}
Push sur TAX_PAID       → mise à jour KPI fiscaux dashboard
Push sur PARTIAL_PAYMENT → alerte solde résiduel
Push sur PENALTY_APPLIED → alerte finance + email admin
```

### Tests

```
TEST-PA-001  initierPaiement lit le solde depuis 441-xxx, pas depuis déclaration seule
TEST-PA-002  confirmerPaiement écrit via FiscalJournalEngine (jamais directement)
TEST-PA-003  Paiement partiel : solde_residuel calculé correctement
TEST-PA-004  Pénalité CG TVA : 10% + 2%/mois calculée depuis date_echéance
TEST-PA-005  Double paiement détecté (référence banque déjà utilisée)
TEST-PA-006  Déclaration.statut = 'payee' après confirmation
TEST-PA-007  solde 441-xxx = 0 après paiement complet
```

---

## ENGINE 7 — FISCAL AUDIT ENGINE

### Responsabilités

```
AU-1  Vérifier la cohérence entre journal_entries et déclarations déposées
AU-2  Calculer le FCI (Fiscal Consistency Index) sur 100 points
AU-3  Détecter les anomalies (CRITIQUE / MAJEURE / MODÉRÉE / MINEURE)
AU-4  Jouer tous les contrôles du Fiscal Controls Catalog (FCC-*)
AU-5  Produire des rapports d'audit complets (pré-déclaration, annuel, sur demande)
AU-6  Ne jamais corriger les erreurs détectées (audit pur — LOI-7)
AU-7  Tracer chaque contrôle (PASS / FAIL / WARN) avec horodatage
AU-8  Alerter proactivement avant les échéances fiscales
```

### Interface principale

```
FiscalAuditEngine {

  auditPeriode(params: AuditParams): AuditReport
  → Lance tous les FCC-* applicables pour une période
  → Calcule FCI partiel
  → Retourne anomalies classées par sévérité

  auditDeclaration(decl_id: UUID): DeclarationAuditReport
  → Vérifie une déclaration spécifique vs journal
  → Détecte écarts entre montants déclarés et montants GL

  getFCIScore(tenant_id: UUID, annee: number): FCIResult
  → Score FCI annuel sur 100
  → Décomposé par dimension (TVA, CNSS, IRPP, IS, Patente)

  runControl(controlCode: string, params: ControlParams): ControlResult
  → Lance un contrôle individuel FCC-xxx
  → Retourne { status: 'PASS'|'FAIL'|'WARN', details, evidence }

  getAnomalies(tenant_id: UUID, annee?: number): Anomalie[]
  → Toutes les anomalies actives non résolues

  acknowledgeAnomalie(anomalie_id: UUID, action: AcknowledgeAction): void
  → Marque une anomalie comme "connue" ou "en cours de correction"
  → NE CORRIGE PAS — crée seulement un log d'acknowledge

  generateAuditReport(tenant_id: UUID, exercice: number): AuditReport
  → Rapport annuel complet (format DGI ou format interne)

}
```

### AuditParams

```
AuditParams {
  tenant_id  : UUID
  pays       : ISO2
  periode    : { annee: number, mois?: number }
  impots?    : ImpotType[]     ← filtrer par impôt
  controls?  : string[]        ← filtrer par code FCC
}
```

### FCIResult

```
FCIResult {
  score_global  : number      ← /100
  dimensions    : {
    tva   : { score, controles: ControlResult[] }
    cnss  : { score, controles: ControlResult[] }
    irpp  : { score, controles: ControlResult[] }
    is    : { score, controles: ControlResult[] }
    patente: { score, controles: ControlResult[] }
    ras   : { score, controles: ControlResult[] }
  }
  anomalies     : Anomalie[]
  certification : 'PASS' | 'REJETÉ'   ← PASS si score ≥ 75/100
  computed_at   : timestamp
}
```

### ControlResult

```
ControlResult {
  code      : string    ← 'FCC-TVA-001'
  status    : 'PASS' | 'FAIL' | 'WARN' | 'N/A'
  sévérité  : 'CRITIQUE' | 'MAJEURE' | 'MODÉRÉE' | 'MINEURE'
  evidence  : {
    expected  : unknown
    actual    : unknown
    source    : 'journal_entries'
    query_ref : string    ← référence à la query GL exécutée
  }
  remediation: string   ← "Vérifier FiscalJournalEngine.writeTVA()"
}
```

### Barème FCI

```
CRITIQUE (−20 pts chacune, auto-refuse si > 0)
  → FCC-TVA-001, FCC-IS-001, FCC-CNSS-001, FCC-IRPP-001

MAJEURE (−10 pts chacune)
  → FCC-TVA-002, FCC-TVA-004, FCC-TVA-006, FCC-CNSS-002,
     FCC-CNSS-004, FCC-IS-003, FCC-IS-004, FCC-IRPP-002

MODÉRÉE (−5 pts chacune)
  → FCC-TVA-003, FCC-TVA-007, FCC-CNSS-003, FCC-IS-005, FCC-PAT-001/002

MINEURE (−2 pts chacune)
  → FCC-PAT-003, FCC-PAT-004, FCC-IRPP-003

Score de départ : 100. FCI = 100 − Σ pénalités.
Certification PASS si FCI ≥ 75 et aucune CRITIQUE.
```

### Events émis

```
AUDIT_COMPLETED      { tenant_id, periode, fci_score, anomalies_count }
ANOMALIE_DETECTED    { tenant_id, code, sévérité, details }
FCI_CERTIFICATION    { tenant_id, annee, score, status: 'PASS'|'REJETÉ' }
CONTROL_PASSED       { control_code, tenant_id, periode }
CONTROL_FAILED       { control_code, tenant_id, periode, evidence }
```

### Realtime

```
Canal : fiscal:audit:{tenant_id}
Push sur ANOMALIE_DETECTED (CRITIQUE) → alerte immédiate rouge dashboard
Push sur FCI_CERTIFICATION            → mise à jour badge FCI
Push sur CONTROL_FAILED               → panel anomalies dashboard
```

### Tests

```
TEST-AU-001  FCI = 100 si aucune anomalie
TEST-AU-002  FCI = 48 sur les données du cas F-005 (réplication)
TEST-AU-003  Auto-refuse si ≥ 1 anomalie CRITIQUE
TEST-AU-004  FCC-TVA-001 PASS si Σ 4441 = l1 déclaration (±0 FCFA)
TEST-AU-005  FCC-IRPP-002 FAIL si l9_tus > 0 après 2026-01-01 pays=CG
TEST-AU-006  FCC-IS-001 FAIL si IS absent de taxes_annuelles CG (avant FM-1)
TEST-AU-007  acknowledgeAnomalie ne corrige pas, ne supprime pas
TEST-AU-008  auditDeclaration détecte écart entre déclaration et GL
```

---

## ENGINE 8 — FISCAL EXPLANATION ENGINE

### Responsabilités

```
EX-1  Être l'interface officielle entre le moteur fiscal et MIAA
EX-2  Répondre aux questions fiscales en langage naturel (FR / EN / langues locales)
EX-3  Expliquer un calcul fiscal en détaillant chaque étape
EX-4  Citer la source légale de chaque règle appliquée
EX-5  Simuler des scénarios fiscaux (preview) sans effets de bord
EX-6  Expliquer les anomalies détectées par l'Audit Engine
EX-7  Générer des explications audit-proof (traçable, vérifiable)
EX-8  Alimenter le chatbot comptable MIAA avec des données structurées
```

### Interface principale

```
FiscalExplanationEngine {

  explain(query: FiscalQuery): FiscalExplanation
  → Point d'entrée universel MIAA
  → Dispatcher vers le bon explainer selon query.type

  explainCalculation(event_id: UUID): CalculationExplanation
  → "Pourquoi ma TVA de juin est 189,000 FCFA ?"
  → Retrace : FiscalEvent → Rule → Calculation → Journal entries

  explainRule(impot: ImpotType, pays: ISO2, date?: Date): RuleExplanation
  → "Quel est le taux de TVA au Congo ?"
  → Cite la source légale (FiscalRule.source_legale)

  explainDeclaration(decl_id: UUID): DeclarationExplanation
  → "Pourquoi ma déclaration TVA de juin est 189,000 FCFA ?"
  → Ligne par ligne, chaque ligne tracée vers journal_entries

  explainAnomalie(anomalie_id: UUID): AnomalieExplanation
  → "Qu'est-ce que l'anomalie B003 ?"
  → Description + impact + action recommandée (pas de correction)

  simulate(scenario: FiscalScenario): SimulationResult
  → "Combien vais-je payer d'IS si mon résultat est 15M ?"
  → Appelle FiscalCalculationEngine.preview() (zéro effets de bord)

  generateSummary(tenant_id: UUID, periode: Periode): FiscalSummary
  → Résumé mensuel/annuel de la situation fiscale
  → Format MIAA : bullets + chiffres clés

}
```

### FiscalQuery

```
FiscalQuery {
  type      : 'calculation' | 'rule' | 'declaration' | 'anomalie'
              | 'simulation' | 'summary' | 'echeance' | 'history'
  intent    : string            ← question MIAA parsée
  params    : Record<string, unknown>
  tenant_id : UUID
  langue    : 'fr' | 'en' | 'ln' | 'kg' | 'sw'
}
```

### FiscalExplanation

```
FiscalExplanation {
  query_id    : UUID
  type        : FiscalQuery['type']
  titre       : string
  corps       : ExplanationBlock[]
  sources     : LegalSource[]     ← règles légales citées
  trace       : TraceStep[]       ← étapes de dérivation
  confiance   : '★★★' | '★★☆' | '★☆☆'
  generated_at: timestamp
}

ExplanationBlock {
  type    : 'text' | 'table' | 'calculation' | 'chart_ref' | 'alert'
  content : string | TableData | CalculationSteps
}
```

### Events émis

```
EXPLANATION_GENERATED  { query_id, type, tenant_id, langue }
SIMULATION_RUN         { scenario, result_summary, tenant_id }
ANOMALIE_EXPLAINED     { anomalie_id, tenant_id }
```

### Realtime

```
Canal : fiscal:miaa:{tenant_id}
Push sur EXPLANATION_GENERATED → réponse chatbot MIAA
Streaming possible pour longues explications (Realtime chunks)
```

### Tests

```
TEST-EX-001  explainCalculation trace l'event → rule → calc → journal
TEST-EX-002  explainRule cite FiscalRule.source_legale (jamais inventée)
TEST-EX-003  simulate n'écrit pas dans journal_entries
TEST-EX-004  explainDeclaration cible journal_entries (jamais factures)
TEST-EX-005  confiance ★★★ si règle CG/CM/GA/CD confirmée LF officielle
TEST-EX-006  Explication en français ET en lingala si langue='ln'
TEST-EX-007  explainAnomalie ne propose pas de correction automatique
```

---

# PARTIE 2 — FISCAL PIPELINE

## Pipeline universel (template)

```
FiscalEvent
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 1 — RULES                                                 │
│  FiscalRulesEngine.getActiveRules(pays, date, impots[])         │
│  → FiscalRule[] (taux, plafonds, comptes, écheances)           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 2 — CALCUL                                                │
│  FiscalCalculationEngine.calculate(event, rules)                │
│  → FiscalCalculation (montants, journal_writes)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 3 — VALIDATION                                            │
│  FiscalValidationEngine.validate(calc, context)                 │
│  → ValidationReport { status: PASS|FAIL|WARN }                 │
└──────────────┬──────────────────────────────┬───────────────────┘
               │ PASS                         │ FAIL
               ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  ÉTAPE 4 — JOURNAL       │   │  ÉTAPE 4bis — ALERT             │
│  FiscalJournalEngine     │   │  VALIDATION_FAILED → Realtime   │
│  .write(calc, validation)│   │  Event → Dashboard + Admin       │
│  → journal_entries       │   │  Pipeline stoppé proprement      │
└──────────────┬───────────┘   └──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 5 — ACCOUNTING EVENT                                      │
│  JOURNAL_WRITTEN → Accounting Core                              │
│  → Grand Livre global mis à jour                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
               ┌─────────────┴─────────────┐
               │                           │
               ▼                           ▼
┌─────────────────────────┐   ┌───────────────────────────────────┐
│  ÉTAPE 6 — DÉCLARATION  │   │  ÉTAPE 6bis — REALTIME           │
│  (à la demande)         │   │  JOURNAL_WRITTEN → Push           │
│  FiscalDeclaration      │   │  → Dashboard compteurs mis à jour │
│  Engine.preRemplir()    │   │  → KPI fiscaux refreshés          │
└──────────────┬──────────┘   └───────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 7 — PAIEMENT (action explicite)                           │
│  FiscalPaymentEngine.initierPaiement()                          │
│  → confirmerPaiement()                                          │
│  → 441-xxx D / 52x C                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 8 — AUDIT (automatique post-paiement + sur demande)      │
│  FiscalAuditEngine.auditPeriode()                               │
│  → FCI mis à jour                                               │
│  → Anomalies détectées notifiées                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 9 — MIAA                                                  │
│  FiscalExplanationEngine.generateSummary()                      │
│  → Réponses aux questions utilisateur                           │
│  → Simulations scénarios fiscaux                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pipeline 1 — FACTURE

```
SOURCE     : app/api/invoice/[id]/emit
EVENT      : INVOICE_ISSUED
PAYLOAD    : { facture_id, montant_ht, pays, nature, client_type, date }

IMPÔTS DÉCLENCHÉS :
  → TVA_[pays]   (toujours si assujetti)
  → CA_CG        (uniquement si pays='CG')

RÈGLES     : TVA_CG { taux:0.18, taxes_add:[CA_CG] }
             CA_CG  { taux:0.05, base:'tva_collectee' }

CALCUL     : tva=montant_ht×0.18, ca=tva×0.05

VALIDATION : VAL-002 (compte 4441 existe), VAL-001 (doublon), VAL-003 (équilibre)

JOURNAL    : ① 411xxx D / 706xxx C  (HT)
             ② 4441   C             (TVA collectée)
             ③ 4441-CA C            (CA — si CG)

DÉCLARATION : declarations_generales l1 += tva, l3 += ca

PAIEMENT   : 441-TVA D, 441-CA D / 52x C (paiement unique DGI)

AUDIT      : FCC-TVA-001 (cohérence), FCC-TVA-002 (CA présent), FCC-TVA-003 (ratio)

REALTIME   : fiscal:journal:{tenant_id} → compteurs TVA mis à jour

MIAA       : "Votre TVA de juin : 180,000 FCFA. CA : 9,000 FCFA. Source : journal"

AVOIR      : Même pipeline, EVENT=INVOICE_CANCELLED, écritures inversées
```

---

## Pipeline 2 — PAIE

```
SOURCE     : app/api/hr/payroll/[id]/pay (bulletin validé)
EVENT      : SALARY_PAID
PAYLOAD    : { bulletin_id, brut, cnss_sal, cnss_pat, irpp, net, pays, periode }
             ⚠️ Montants DÉJÀ CALCULÉS par calcul-paie.ts (INTOUCHABLE)
             ⚠️ FiscalEngine NE RECALCULE PAS — il journalise

IMPÔTS DÉCLENCHÉS :
  → CNSS_[pays]  (cnss_salarie + cnss_patronal depuis payload)
  → IRPP_[pays]  (irpp depuis payload)

RÈGLES     : Utilisées UNIQUEMENT pour validation (plafonds, SMIG, TUS=0)

CALCUL     : Transmission directe des montants payload → journal_writes
             (pas de recalcul — résout B006)

VALIDATION : VAL-007 (SMIG), VAL-010 (TUS=0 si CG+2026), VAL-001 (doublon)

JOURNAL    : ① 661-CNSS-SAL D / 431-CNSS-SAL C  (cnss salarié)
             ② 661-CNSS-PAT D / 431-CNSS-PAT C  (cnss patronal)
             ③ 661-IRPP D    / 447 C             (irpp retenu)
             ④ 661-NET D     / 421 C             (net à payer)
             Atomic batch sur les 4 paires

DÉCLARATION : CNSS : Σ 431 → total nominatif
              DGI  : Σ 447 → l8_irpp, l9_tus=0

PAIEMENT   : 431 D / 52x C (CNSS — avant le 15)
             447 D / 52x C (IRPP — avant le 20)

AUDIT      : FCC-CNSS-001, FCC-CNSS-002 (SMIG), FCC-IRPP-001, FCC-IRPP-002 (TUS)

REALTIME   : fiscal:journal:{tenant_id} → KPI charges salariales mis à jour

MIAA       : "Charges fiscales juin pour [employé] : CNSS=136,400, IRPP=4,413"
```

---

## Pipeline 3 — CLÔTURE

```
SOURCE     : app/api/accounting/year-close
EVENT      : YEAR_CLOSED
PAYLOAD    : { exercice, resultat_avant_is, ca_ht_annuel, tenant_id, pays }

IMPÔTS DÉCLENCHÉS :
  → IS_[pays]  (calcul annuel + régularisation avances)
  → PATENTE (alerte échéance 31/01)
  → TVTS (alerte si applicable)

RÈGLES     : IS_CG { taux:0.30, minimum:0.01, echeance:30/04/N+1 }

CALCUL     : is_theorique = resultat × 0.30
             minimum = ca_ht × 0.01
             is_du = max(theorique, minimum)
             solde = is_du − Σavances_T1..T4

VALIDATION : VAL-003, VAL-005 (is_du ≠ 0 si résultat > 0)

JOURNAL    : ① 695 D / 441-IS C  (régularisation IS)
             Σtotal 695 exercice = is_du (avances + régularisation)

ÉTATS FIN. : genererCompteResultat() → ligne RS (695) ≠ 0
             Résultat net = résultat_avant_is − is_du

DÉCLARATION : declarations_is { is_du, avances, solde, echeance:30/04/N+1 }

PAIEMENT   : Avances : 441-IS D / 52x C (× 4 trimestres)
             Solde   : 441-IS D / 52x C (30 avril N+1)

AUDIT      : FCC-IS-001, FCC-IS-002, FCC-IS-003, FCC-IS-004, FCC-IS-005

REALTIME   : fiscal:declarations:{tenant_id} → statut IS mis à jour

MIAA       : "IS 2026 = 3,000,000 FCFA. 4 avances versées = 600,000.
              Solde à payer avant 30/04/2027 = 2,400,000 FCFA."

AVANCES TRIMESTRIELLES :
  EVENT : QUARTER_CLOSED { q:1|2|3|4, resultat_ytd, ca_ht_ytd }
  CALCUL: avance = is_annuel_estimé / 4
  JOURNAL: 695 D / 441-IS C
```

---

## Pipeline 4 — ACHATS

```
SOURCE     : app/api/purchases/[id]/record
EVENT      : PURCHASE_RECORDED
PAYLOAD    : { achat_id, montant_ht, pays, fournisseur_id, nature_achat, date }

IMPÔTS DÉCLENCHÉS :
  → TVA déductible (si achat taxable lié à activité imposée)
  → RAS sur honoraires (si nature='honoraire')
  → RAS sur loyers    (si nature='loyer')

CALCUL     : tva_ded = montant_ht × taux_tva (si déductible)
             ras = montant_brut × taux_ras    (si RAS applicable)

JOURNAL    : ① 60xxxx D / 4445 D / 401xxx C  (achat + TVA déductible)
             ② 622 D   / 447-RAS C / 401 C    (si honoraire avec RAS)

DÉCLARATION : declarations_generales l2 += tva_ded
              declarations_ras (trimestrielle)

AUDIT      : FCC-TVA-001 (tva_ded cohérente avec factures d'achat)

MIAA       : "TVA déductible juin : 35,000 FCFA sur 6 achats"
```

---

## Pipeline 5 — STOCKS

```
SOURCE     : app/api/inventory/[id]/valorize
EVENT      : STOCK_ADJUSTED
PAYLOAD    : { article_id, quantite, valeur_unitaire, type_mvt, pays }

IMPÔTS DÉCLENCHÉS :
  → TVA (si mouvement génère un fait générateur : sortie pour usage propre)
  → Pas de TVA sur mouvements internes (transfert stock→stock)

TRAITEMENT FISCAL :
  Sortie pour usage propre → assimilée à une livraison à soi-même
  → EVENT = INVOICE_ISSUED (usage_propre=true)
  → Pipeline Facture activé

JOURNAL    : Via Pipeline Facture si usage propre, sinon entrée comptable pure
             (classe 3 — hors périmètre fiscal direct)

AUDIT      : Vérifier que sorties pour usage propre ≠ ventes non déclarées
```

---

## Pipeline 6 — RESTAURANT

```
SOURCE     : app/api/restaurant/[table]/close-ticket
EVENT      : TICKET_CLOSED
PAYLOAD    : { ticket_id, montant_ht, pays, mode_paiement, date }

IMPÔTS DÉCLENCHÉS :
  → TVA (prestation de service = TVA sur encaissement si pays='CG')
  → CA_CG (si pays='CG')

PARTICULARITÉ :
  Restaurant CG → TVA sur encaissement (FXC-CG-006)
  EVENT TRIGGER : PAYMENT_RECEIVED (pas INVOICE_ISSUED)

JOURNAL    : Même écritures que Pipeline Facture mais déclenchées à l'encaissement
             4441 C au moment du paiement client (pas à la prise de commande)

DÉCLARATION : Inclus dans TVA mensuelle standard

MIAA       : "TVA restaurant juillet : 45,000 FCFA sur 250 tickets"
```

---

## Pipeline 7 — SANTÉ

```
SOURCE     : app/api/health/consultation/[id]/invoice
EVENT      : CONSULTATION_INVOICED
PAYLOAD    : { consultation_id, patient_id, montant_ht, actes[], pays,
               tiers_payant: boolean, caisse_id }

IMPÔTS DÉCLENCHÉS :
  → TVA (si actes taxables — actes médicaux souvent exonérés selon pays)
  → Vérification exonération selon liste actes RAMU/CAMU (CG) / CAMU (CM)

RÈGLES SPÉCIALES :
  CG : Actes RAMU → exonérés TVA (FXC-CG-001 étendu aux actes médicaux publics)
  CM : Actes médicaux essentiels → taux zéro TVA
  → FiscalRulesEngine.getActiveRule retourne taux=0 si acte exonéré

TIERS PAYANT :
  Si tiers_payant=true → créance sur caisse_id (417-CAISSE)
  TVA due même si paiement différé

JOURNAL    : ① 411/417 D / 706 C  (créance patient ou caisse)
             ② 4441 C             (si TVA applicable, sinon zéro)

MIAA       : "Chiffre d'affaires santé : 2,450,000 HT. TVA : 0 FCFA (actes exonérés)"
```

---

## Pipeline 8 — ÉCOLE

```
SOURCE     : app/api/school/enrollment/[id]/invoice
EVENT      : TUITION_INVOICED
PAYLOAD    : { inscription_id, eleve_id, montant_ht, niveau, pays, annee_scolaire }

IMPÔTS DÉCLENCHÉS :
  → TVA (frais de scolarité : exonérés dans la plupart des pays CEMAC)
  → IS sur résultat d'exploitation annuel
  → CNSS sur personnel enseignant (Pipeline Paie)

RÈGLES SPÉCIALES :
  Enseignement privé → souvent exonéré TVA (établissement d'enseignement reconnu)
  ONG scolaire → IS exonéré si statut validé (FXC-CG-005 étendu)

JOURNAL    : 411 D / 706-SCOLARITE C (HT)
             TVA = 0 si exonéré

AUDIT      : Vérifier statut fiscal de l'établissement (exonéré ou non)
```

---

## Pipeline 9 — HÔTEL

```
SOURCE     : app/api/hotel/checkout/[id]
EVENT      : CHECKOUT_INVOICED
PAYLOAD    : { sejour_id, client_id, montant_ht, nuits, pays, date_depart }

IMPÔTS DÉCLENCHÉS :
  → TVA (hébergement = prestation de service)
  → CA_CG (si pays='CG')
  → Taxe de séjour (taxe locale — si configurée)

PARTICULARITÉ :
  TVA sur encaissement pour hôtels (prestation de service CG)
  Taxe de séjour : compte 447-TSJ, déclaration municipale

JOURNAL    : ① 411 D   / 706 C    (HT séjour)
             ② 4441 C             (TVA)
             ③ 4441-CA C          (CA si CG)
             ④ 447-TSJ C          (taxe séjour si applicable)

MIAA       : "Nuitées juillet : 145. CA HT : 8,700,000. TVA : 1,566,000. CA : 78,300."
```

---

## Pipeline 10 — ONG

```
SOURCE     : app/api/ong/grant/[id]/receive
EVENT      : GRANT_RECEIVED
PAYLOAD    : { grant_id, montant, bailleur, pays, nature: 'subvention'|'don' }

IMPÔTS DÉCLENCHÉS :
  → TVA : exonérée sur subventions et dons (usage humanitaire)
  → IS  : exonéré si statut ONG validé (FXC-CG-005)
  → CNSS : applicable sur salaires du personnel ONG (Pipeline Paie)

RÈGLES SPÉCIALES :
  ONG reconnue → IS = 0, TVA = 0 sur subventions
  Si ONG vend des produits/services → TVA normale sur ces activités

JOURNAL    : 521/411 D / 75-SUBVENTION C (selon nature)
             TVA = 0 si subvention pure

AUDIT      : Vérifier séparation activités exonérées vs activités taxables
```

---

## Pipeline 11 — AGRICULTURE

```
SOURCE     : app/api/agri/harvest/[id]/sell
EVENT      : HARVEST_SOLD
PAYLOAD    : { lot_id, culture, quantite, prix_unitaire, acheteur_id, pays }

IMPÔTS DÉCLENCHÉS :
  → TVA (taux réduit ou zéro selon culture et pays)
  → IS réduit (activités agricoles : 20% RCA, normal ailleurs)
  → Cotisations sociales agricoles (si salariés agricoles)

RÈGLES SPÉCIALES :
  Produits alimentaires de base → taux réduit TVA (GA 10%, GQ 5%)
  Gabon : liste cultures exonérées TVA (légumes locaux, poissons)

JOURNAL    : 411 D / 706-AGRI C (HT)
             4441 D  (TVA réduite ou zéro)
```

---

## Pipeline 12 — BTP

```
SOURCE     : app/api/btp/invoice/[id]/emit
EVENT      : BTP_INVOICE_ISSUED
PAYLOAD    : { marché_id, situation_id, avancement_pct, montant_ht, client_type, pays }

IMPÔTS DÉCLENCHÉS :
  → TVA (travaux = prestation de service)
  → RAS marchés publics (si client = État/administation)
  → Retenue de garantie (5% → 447-GAR, pas un impôt mais à tracer)

RÈGLES SPÉCIALES :
  Marchés publics CG → RAS 2.5% précompté par l'État (FRC-RAS-004)
  Retenue de garantie → 447-GARANTIE (libérée à réception définitive)

JOURNAL    : ① 411/416-ETAT D / 706 C          (HT)
             ② 4441 C                            (TVA)
             ③ 4441-CA C                         (CA si CG)
             ④ 447-RAS D sur montant État         (RAS précompté)
             ⑤ 447-GARANTIE C                    (retenue garantie)

MIAA       : "Situation n°3 — Avancement 65%. TVA : 450,000 FCFA.
              RAS État : 25,000 FCFA. Retenue garantie : 87,500 FCFA."
```

---

# PARTIE 3 — ARCHITECTURE OFFICIELLE

## 3.1 — Diagramme général complet

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                         ORAFORME FISCAL ENGINE ARCHITECTURE                      ║
║                                   v1.0                                           ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  COUCHE SOURCES                                                                  ║
║  ─────────────                                                                   ║
║  [Facture] [Paie] [Achat] [Stock] [Clôture] [Restaurant] [Santé] [BTP]...      ║
║       │         │       │       │        │          │        │       │           ║
║       └─────────┴───────┴───────┴────────┴──────────┴────────┴───────┘           ║
║                                    │ emitFiscalEvent()                           ║
║                                    ▼                                             ║
║  COUCHE ÉVÉNEMENTS                                                               ║
║  ─────────────────                                                               ║
║  ┌─────────────────────────────────────────────────────────────────────┐        ║
║  │                    FISCAL EVENT BUS                                  │        ║
║  │  INVOICE_ISSUED · SALARY_PAID · PURCHASE_RECORDED · YEAR_CLOSED    │        ║
║  │  QUARTER_CLOSED · TICKET_CLOSED · CONSULTATION_INVOICED · ...       │        ║
║  └──────────────────────────────┬──────────────────────────────────────┘        ║
║                                  │                                               ║
║  COUCHE RÈGLES                   ▼                                               ║
║  ─────────────  ┌───────────────────────────────────┐                           ║
║                 │      FISCAL RULES ENGINE           │                           ║
║                 │  fiscal_rules (immuable)           │                           ║
║                 │  getActiveRule(pays, impot, date)  │                           ║
║                 └─────────────────┬─────────────────┘                           ║
║                                   │ FiscalRule[]                                 ║
║  COUCHE CALCUL                    ▼                                               ║
║  ──────────────  ┌────────────────────────────────────────┐                     ║
║                  │     FISCAL CALCULATION ENGINE           │                     ║
║                  │  Pure functions — zéro DB               │                     ║
║                  │  TVA · CA · IRPP · CNSS · IS · PAT · RAS│                     ║
║                  └──────────────────┬──────────────────────┘                    ║
║                                     │ FiscalCalculation                          ║
║  COUCHE VALIDATION                  ▼                                            ║
║  ─────────────────  ┌────────────────────────────────────┐                      ║
║                     │    FISCAL VALIDATION ENGINE         │                      ║
║                     │  Checks sans DB — PASS|FAIL|WARN   │                      ║
║                     └──────────────┬─────────────────────┘                      ║
║                                    │ ValidationReport                            ║
║                         PASS ◄─────┴──────► FAIL                                ║
║                           │                    │                                 ║
║  COUCHE JOURNAL            ▼                   ▼                                 ║
║  ──────────────  ┌──────────────────┐   ┌──────────────────┐                   ║
║                  │ FISCAL JOURNAL   │   │  ALERT ENGINE    │                   ║
║                  │    ENGINE        │   │  Push Realtime   │                   ║
║                  │  SINGLE WRITER   │   │  Dashboard alerte│                   ║
║                  └────────┬─────────┘   └──────────────────┘                   ║
║                           │                                                      ║
║  SOURCE DE VÉRITÉ         ▼                                                      ║
║  ─────────────── ┌─────────────────────────────────────────┐                   ║
║                  │         journal_entries                   │                   ║
║                  │  SEULE SOURCE DE VÉRITÉ FISCALE          │                   ║
║                  │  (append-only, source='fiscal_engine')   │                   ║
║                  └────┬──────────┬──────────┬──────────┬────┘                  ║
║                       │          │          │          │                         ║
║  COUCHE LECTURE        ▼          ▼          ▼          ▼                        ║
║  ──────────────  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────────┐               ║
║                  │DECLA-│  │PAYE- │  │AUDIT │  │EXPLANATION   │               ║
║                  │RATION│  │MENT  │  │ENGINE│  │ENGINE (MIAA) │               ║
║                  │ENGINE│  │ENGINE│  │FCI   │  │Chatbot fiscal│               ║
║                  └──┬───┘  └──┬───┘  └──┬───┘  └──────┬───────┘               ║
║                     │        │          │              │                         ║
║  COUCHE SORTIE       ▼        ▼          ▼              ▼                        ║
║  ──────────────  [DGI PDF] [Reçu] [Rapport FCI]  [MIAA réponses]               ║
║                  [CNSS]    [Hist.] [Anomalies]    [Simulations]                 ║
║                  [Dash.]   [KPIs]  [Certification] [Explications]               ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3.2 — Ownership Map

```
COMPOSANT                 │ OWNER          │ ÉCRIT     │ LIT
──────────────────────────┼────────────────┼───────────┼──────────────────────
FiscalRulesEngine         │ Rules Engine   │ fiscal_rules        │ Lui-même
FiscalCalculationEngine   │ Calc Engine    │ RIEN (pure fn)      │ FiscalRule
FiscalValidationEngine    │ Valid. Engine  │ RIEN (pure fn)      │ FiscalCalculation
FiscalJournalEngine       │ Journal Engine │ journal_entries ✅   │ Lui-même
FiscalDeclarationEngine   │ Decl. Engine   │ declarations_*      │ journal_entries
FiscalPaymentEngine       │ Paym. Engine   │ Via Journal (441/52)│ journal_entries + decl
FiscalAuditEngine         │ Audit Engine   │ audit_results       │ journal_entries + decl
FiscalExplanationEngine   │ Expl. Engine   │ RIEN (lecture pure) │ Tous les engines
──────────────────────────┼────────────────┼─────────────────────┼────────────────
ERP Core (Factures etc.)  │ Métier         │ tables métier       │ NE LIT JAMAIS fiscal
Accounting Core           │ Compta.        │ états financiers     │ journal_entries
MIAA                      │ IA             │ RIEN                │ Via ExplanationEngine
```

---

## 3.3 — Contrats d'interface inter-engines

```
CONTRACT-01  FiscalEventBus → FiscalRulesEngine
  CALL   : getActiveRules(pays, date, impots)
  RETURN : FiscalRule[]
  SLA    : < 50ms (cache L1 en mémoire pour règles du jour)
  ERROR  : RuleConflictError (jamais silencieux)

CONTRACT-02  FiscalRulesEngine → FiscalCalculationEngine
  CALL   : calculate(event, rules[])
  RETURN : FiscalCalculation
  SLA    : < 100ms
  PURE   : OUI — même entrée → même sortie toujours

CONTRACT-03  FiscalCalculationEngine → FiscalValidationEngine
  CALL   : validate(calc, context)
  RETURN : ValidationReport
  SLA    : < 50ms
  PURE   : OUI

CONTRACT-04  FiscalValidationEngine → FiscalJournalEngine
  CALL   : write(calc, validationReport)
  GUARD  : Appel bloqué si validationReport.status ≠ 'PASS'
  RETURN : WriteResult
  SLA    : < 200ms (transaction DB)
  ATOMIC : OUI — tout ou rien

CONTRACT-05  FiscalJournalEngine → FiscalDeclarationEngine
  VIA    : JOURNAL_WRITTEN event (push, pas d'appel direct)
  READ   : sumByCompte(tenant_id, pays, impot, periode)
  RETURN : CompteBalance[]
  SLA    : < 300ms (query indexée)

CONTRACT-06  FiscalJournalEngine → FiscalPaymentEngine
  READ   : readByPeriode(params)
  RETURN : JournalEntry[]
  GUARD  : FiscalPaymentEngine ne confirme que si solde 441 > 0

CONTRACT-07  FiscalJournalEngine → FiscalAuditEngine
  READ   : readByPeriode + sumByCompte
  GUARD  : FiscalAuditEngine NE MODIFIE JAMAIS journal_entries
  RETURN : Résultats controls

CONTRACT-08  Tout Engine → FiscalExplanationEngine
  READ   : tous les engines via leurs interfaces publiques
  GUARD  : ExplanationEngine NE MODIFIE RIEN
  RETURN : FiscalExplanation

CONTRACT-09  FiscalPaymentEngine → FiscalJournalEngine
  CALL   : write(paymentCalc, validationReport)  ← passe par le pipeline complet
  NE PAS : écrire directement dans journal_entries
```

---

## 3.4 — API officielle du Fiscal Engine

### Endpoints publics (consommés par UI et ERP)

```
POST   /api/fiscal/events                → emitFiscalEvent() (ERP Core)
GET    /api/fiscal/rules?pays=CG&impot=TVA&date=2026-07-01
GET    /api/fiscal/rules/{id}
GET    /api/fiscal/rules/{id}/history

POST   /api/fiscal/calculate/preview     → FiscalCalculationEngine.preview()
       Body: { pays, impot, params, date }

GET    /api/fiscal/declarations?tenant={id}&type=tva&annee=2026&mois=6
POST   /api/fiscal/declarations          → FiscalDeclarationEngine.deposer()
GET    /api/fiscal/declarations/{id}/pdf → FiscalDeclarationEngine.genererPDF()
GET    /api/fiscal/declarations/{id}/reconciliation

GET    /api/fiscal/echeances?tenant={id}&pays=CG
GET    /api/fiscal/payments?tenant={id}&annee=2026
POST   /api/fiscal/payments/initiate     → FiscalPaymentEngine.initierPaiement()
POST   /api/fiscal/payments/{id}/confirm → FiscalPaymentEngine.confirmerPaiement()

GET    /api/fiscal/audit?tenant={id}&annee=2026
GET    /api/fiscal/audit/fci?tenant={id}&annee=2026
GET    /api/fiscal/audit/anomalies?tenant={id}
POST   /api/fiscal/audit/acknowledge/{id}

POST   /api/fiscal/explain               → FiscalExplanationEngine.explain()
       Body: { type, params, langue }
POST   /api/fiscal/simulate             → FiscalExplanationEngine.simulate()
```

### Endpoints admin (gestion des règles)

```
GET    /api/admin/fiscal/rules/catalog?pays=CG
POST   /api/admin/fiscal/rules           → FiscalRulesEngine.activateRule()
DELETE /api/admin/fiscal/rules/{id}      → FiscalRulesEngine.deactivateRule()
GET    /api/admin/fiscal/rules/validate  → FiscalRulesEngine.validateRule()
```

---

## 3.5 — Versioning Strategy

```
NIVEAU 1 — Versioning des Règles Fiscales
  Stratégie : Immutable + effective_from/until
  Garantie  : Tout calcul historique reproductible avec la règle active à la date

NIVEAU 2 — Versioning des Engines (API)
  Stratégie : Semantic versioning sur les contrats inter-engines
  Règle     : Breaking change = nouvelle version majeure avec migration
  Exemple   : FiscalCalculationEngine.calculateTVA v1 → v2 (nouvelle signature)
              Période de coexistence obligatoire ≥ 30 jours

NIVEAU 3 — Versioning des Déclarations
  Stratégie : Snapshot immuable à la date de dépôt
  Correction : Déclaration rectificative (nouvelle entrée, référence originale)

NIVEAU 4 — Versioning du Journal
  Stratégie : Append-only (jamais UPDATE)
  Correction : Extourne signée (écriture inverse + audit trail)

NIVEAU 5 — Versioning des Pipelines
  Stratégie : Backward compatible — nouveau pipeline v2 coexiste avec v1
  Activation : Feature flag par tenant_id (migration progressive)
```

---

# PARTIE 4 — FOUNDATION MIGRATIONS

## FM-1 — FiscalRulesEngine + Registry

```
OBJECTIF  : Créer le registre immuable de toutes les règles fiscales
DURÉE     : 3 jours
BLOCAGE   : Aucune dépendance externe
STATUT FM : Migration moteur (pas correction de bug)

LIVRABLES :
  ① Structure de données FiscalRule (TypeScript types)
  ② FiscalRulesEngine avec 5 méthodes principales
  ③ Seed complet : 31 règles FRC-* (depuis F005.2-FISCAL-CATALOGS.md)
  ④ Tests unitaires (TEST-RE-001 à TEST-RE-008)
  ⑤ API endpoints /api/fiscal/rules

RÈGLES À INJECTER (priorité ★★★) :
  TVA_CG  (0.18, correction CA présent)
  TVA_CM  (0.175 — correction critique erreur 0.1925)
  TVA_GA  (0.18, taux_réduit 0.10)
  CA_CG   (0.05)
  IRPP_CG (barème 5 tranches)
  CNSS_CG (5 branches, plafonds corrects)
  IS_CG   (0.30, minimum 0.01 — NOUVEAU, résout B001)
  PATENTE_CG (barème LF 2026)
  TUS_FISCALE_CG (taux=0.00 — résout B003)
  SMIG_CG (70400 — résout erreur 90000)
  [+ IRPP_CM, CNPS_CM, IS_CM, TVA_GA, IS_GA, CNSS_GA, IS_CD, TVA_CD]

TABLES CRÉÉES :
  fiscal_rules { id, code, pays, impot, version, effective_from,
                 effective_until, parametres, source_legale }
  (RLS: seul admin tenant peut lire les règles de son pays)

CERTIFICATION FM-1 :
  ✅ getActiveRule('CG','TVA','2026-06-01') → taux=0.18
  ✅ getActiveRule('CM','TVA','2026-06-01') → taux=0.175
  ✅ getActiveRule('CG','IS','2026-12-31')  → non null (B001 résolu)
  ✅ TUS_FISCALE_CG.taux = 0 après 2026-01-01
  ✅ SMIG_CG = 70,400 FCFA
  ✅ Aucune règle dupliquée active simultanément

INTOUCHABLE : lib/paie/calcul-paie.ts — aucune modification
```

---

## FM-2 — FiscalCalculationEngine + FiscalJournalEngine

```
OBJECTIF  : Calculateurs purs + unique writer journal
DURÉE     : 4 jours
BLOCAGE   : FM-1 doit être complète (règles nécessaires)
STATUT FM : Migration moteur

LIVRABLES :
  ① FiscalCalculationEngine (8 méthodes : calculate, TVA, IRPP, CNSS, IS, PAT, RAS, preview)
  ② FiscalJournalEngine (write, writeBatch, read*, sum*, getByEventId)
  ③ Tests unitaires Calculation (TEST-CA-001 à TEST-CA-012)
  ④ Tests unitaires Journal (TEST-JO-001 à TEST-JO-008)
  ⑤ API /api/fiscal/calculate/preview

RÈGLE ABSOLUE FM-2 :
  FiscalCalculationEngine = zéro accès DB
  → Passer les données comme paramètres (pas de fetch interne)
  FiscalJournalEngine = seul writer pour entrées fiscales
  → Tous les autres writers DB existants bloqués sur les comptes 4441/4445/431/447/695

MIGRATION CNSS (résout B006) :
  SALARY_PAID → FiscalJournalEngine reçoit les montants du payload event
  (montants calculés par calcul-paie.ts — non recalculés)

MIGRATION TVA CA (résout A001) :
  INVOICE_ISSUED → calculerCA(tva, CA_CG_rule) → FiscalJournalEngine.write(4441-CA C)

CERTIFICATION FM-2 :
  ✅ calculateTVA(1000000, TVA_CG) → { tva:180000, ca:9000, ttc:1189000 }
  ✅ calculateIS(10M, 60M, IS_CG) → { is_du:3000000, minimum:600000 }
  ✅ write() bloqué si ValidationReport.status ≠ 'PASS'
  ✅ journal_entries.source = 'fiscal_engine' sur toutes nouvelles entrées
  ✅ Pas de write direct depuis factures/bulletins_paie (tests d'intégration)
```

---

## FM-3 — FiscalEventBus + FiscalValidationEngine

```
OBJECTIF  : Bus d'événements + validateur pré-journal
DURÉE     : 3 jours
BLOCAGE   : FM-2 doit être complète
STATUT FM : Migration moteur

LIVRABLES :
  ① FiscalEventBus (emit, subscribe, unsubscribe, replay)
  ② FiscalValidationEngine (validate, validatePreJournal, isDuplicate)
  ③ Pipeline complet : Event → Rules → Calc → Validation → Journal
  ④ Tests unitaires Validation (TEST-VA-001 à TEST-VA-008)
  ⑤ Tests d'intégration pipeline (au moins 3 pipelines complets)

BUS D'ÉVÉNEMENTS :
  Subscribers par type :
    INVOICE_ISSUED     → [TVAHandler, CAHandler(si CG)]
    SALARY_PAID        → [CNSSHandler, IRPPHandler]
    PURCHASE_RECORDED  → [TVADeductibleHandler, RASHandler(si applicable)]
    QUARTER_CLOSED     → [ISAvanceHandler]
    YEAR_CLOSED        → [ISHandler, PatenteReminderHandler]

VALIDATION CRITIQUE :
  VAL-010 implémenté : TUS > 0 après 2026 → FAIL automatique (B003)
  VAL-001 implémenté : doublon event_id → FAIL automatique

CERTIFICATION FM-3 :
  ✅ SALARY_PAID → CNSS + IRPP journalisés (batch atomique)
  ✅ INVOICE_ISSUED CG → TVA + CA journalisés
  ✅ Pipeline complet testé de l'event jusqu'à journal_entries
  ✅ Doublon rejeté (idempotence)
  ✅ TUS = 0 validé automatiquement
  ✅ Realtime push sur JOURNAL_WRITTEN
```

---

## FM-4 — FiscalDeclarationEngine + FiscalPaymentEngine + FiscalAuditEngine + FiscalExplanationEngine

```
OBJECTIF  : Lecture + Déclarations + Paiements + Audit + MIAA
DURÉE     : 5 jours
BLOCAGE   : FM-3 doit être complète
STATUT FM : Migration moteur

LIVRABLES :
  ① FiscalDeclarationEngine (preRemplir, deposer, reconcilier, getEcheances, genererPDF)
  ② FiscalPaymentEngine (initierPaiement, confirmerPaiement, calculerPénalités)
  ③ FiscalAuditEngine (auditPeriode, getFCIScore, runControl × 24 contrôles FCC)
  ④ FiscalExplanationEngine (explain, explainCalculation, simulate, generateSummary)
  ⑤ Tables DB : declarations_*, declarations_cnss_lignes, declarations_is,
                 audit_results, payment_history
  ⑥ Tests unitaires (TEST-DE-*, TEST-PA-*, TEST-AU-*, TEST-EX-*)
  ⑦ API complète /api/fiscal/*

MIGRATION DÉCLARATION (résout B002) :
  FiscalDeclarationEngine.preRemplir() lit UNIQUEMENT journal_entries
  preRemplirDeclaration() existant → déprécié, redirigé vers nouveau engine

MIGRATION TUS (résout B003) :
  FiscalDeclarationEngine : l9_tus = 0 si pays='CG' AND date >= 2026-01-01
  (Contrôle FCC-IRPP-002 + VAL-010)

MIGRATION IS (résout B001 + A002) :
  IS_CG présent dans taxa_annuelles après FM-1
  FiscalDeclarationEngine.preRemplir({ type:'is' }) → rempli depuis 695
  genererCompteResultat() → ligne RS ≠ 0 si IS payé

MIGRATION CNSS (résout B006) :
  FiscalDeclarationEngine lisant 431 (journal) pour totaux
  Lignes nominatives : bulletins_paie comme référence, pas source de calcul

AUDIT FCI TARGET :
  24 contrôles FCC implémentés
  FCI attendu post-FM-4 : ≥ 85/100 (CERTIFICATION PASS)

CERTIFICATION FM-4 :
  ✅ preRemplir() source = 'journal_entries' sur toutes les lignes
  ✅ l9_tus = 0 pour CG 2026
  ✅ FCI score calculé correctement (replicer le score F-005 = 48)
  ✅ FCI post-migration ≥ 75 (PASS)
  ✅ IS visible dans Compte de Résultat
  ✅ explainCalculation trace l'event complet
  ✅ simulate() ne modifie pas journal_entries
  ✅ MIAA peut répondre aux 10 questions fiscales standard
```

---

## Calendrier des migrations

```
SEMAINE 1  FM-1 — FiscalRulesEngine + seed 31 règles
  J1-J2 : Types + interfaces + tests
  J3    : Seed règles + activation + certification

SEMAINE 2  FM-2 — FiscalCalculationEngine + FiscalJournalEngine
  J1-J2 : Calculation Engine (8 calculateurs purs)
  J3-J4 : Journal Engine (write + reads) + tests intégration

SEMAINE 3  FM-3 — FiscalEventBus + FiscalValidationEngine
  J1-J2 : Event Bus + handlers INVOICE_ISSUED, SALARY_PAID
  J3    : Validation Engine + pipeline intégration complète

SEMAINE 4-5  FM-4 — 4 engines lecture
  J1-J2 : DeclarationEngine + tests + PDF
  J3    : PaymentEngine + calcul pénalités
  J4    : AuditEngine + 24 contrôles FCC
  J5    : ExplanationEngine + MIAA + certification finale

FCI CIBLE : 85/100 à la fin de FM-4
```

---

# PARTIE 5 — CERTIFICATIONS ENGINE

## Conditions d'auto-refuse (Fiscal Engine Design)

```
Le Fiscal Engine Design est REJETÉ si l'une de ces conditions est vraie :

COND-1  Un Engine écrit dans journal_entries sans passer par FiscalJournalEngine
COND-2  FiscalDeclarationEngine lit depuis une table autre que journal_entries
COND-3  FiscalCalculationEngine a un effet de bord (lecture ou écriture DB)
COND-4  Une FiscalRule est modifiée après création (pas de new version créée)
COND-5  Un FiscalEvent déclenche un calcul sans passer par FiscalRulesEngine
COND-6  FiscalAuditEngine corrige des données (il ne peut qu'observer)
COND-7  FiscalExplanationEngine répond avec des données non tracées au GL
```

## Checklist certification

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║           F-006 — FISCAL ENGINE DESIGN — CERTIFICATION                       ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  CONDITIONS AUTO-REFUSE (toutes doivent être ✅ PASS)                       ║
║                                                                              ║
║  ✅ COND-1  FiscalJournalEngine = seul writer fiscal                        ║
║  ✅ COND-2  FiscalDeclarationEngine lit uniquement journal_entries           ║
║  ✅ COND-3  FiscalCalculationEngine pure (zéro DB)                          ║
║  ✅ COND-4  Règles immuables (versioning par new row)                       ║
║  ✅ COND-5  Tout calcul passe par FiscalRulesEngine                         ║
║  ✅ COND-6  FiscalAuditEngine observateur pur                               ║
║  ✅ COND-7  FiscalExplanationEngine 100% GL-tracé                           ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  COUVERTURE                                                                  ║
║                                                                              ║
║  ✅ 8 engines définis (Responsabilités · Interface · Tests · Consumers)     ║
║  ✅ 12 pipelines métier (Facture · Paie · Clôture · Achats · Stocks ·      ║
║     Restaurant · Santé · École · Hôtel · ONG · Agriculture · BTP)          ║
║  ✅ 4 Foundation Migrations définies (FM-1 → FM-4, 15 jours total)         ║
║  ✅ Contrats inter-engines (CONTRACT-01 à CONTRACT-09)                      ║
║  ✅ API complète documentée                                                  ║
║  ✅ Ownership Map                                                            ║
║  ✅ Versioning Strategy (5 niveaux)                                         ║
║  ✅ Diagramme architecture complet                                          ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  CORRECTIONS CRITIQUES EMBARQUÉES                                            ║
║                                                                              ║
║  ✅ B001  IS_CG ajouté dans FM-1 (plus absent de taxes_annuelles)          ║
║  ✅ B002  DeclarationEngine lit uniquement journal_entries (plus factures)  ║
║  ✅ B003  TUS_FISCALE_CG = 0 depuis 2026-01-01 (VAL-010 + FCC-IRPP-002)   ║
║  ✅ B006  SALARY_PAID journalise payload (plus recalcul depuis brut)        ║
║  ✅ A001  CA journalisé sur compte dédié 4441-CA (plus calculé à postériori)║
║  ✅ A002  IS visible dans Compte de Résultat (ligne 695 ≠ 0)               ║
║  ✅ A003  TVA_CM = 17.5% (correction erreur 19.25%)                        ║
║  ✅ SMIG  SMIG_CG = 70,400 FCFA (correction erreur 90,000)                 ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  VERDICT                                                                     ║
║                                                                              ║
║   ✅  F-006 — FISCAL ENGINE DESIGN CERTIFIÉ                                 ║
║                                                                              ║
║   Prêt pour implémentation FM-1 → FM-4                                      ║
║   FCI cible post-implémentation : 85/100                                     ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

*F-006 — Fiscal Engine Design — Document officiel*  
*Complément : F005-FCI-FISCAL-CERTIFICATION.md · F005.1-FOUNDATION-FISCAL-CORE.md · F005.2-FISCAL-KNOWLEDGE-BASE.md · F005.2-FISCAL-CATALOGS.md*  
*Prochaine étape : FM-1 — FiscalRulesEngine*
