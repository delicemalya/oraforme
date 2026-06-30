# CONSTITUTION D'INGÉNIERIE ORAFORME
**Version 2.0 — Document fondateur**
*Référence unique pour reconstruire et faire évoluer Oraforme jusqu'à un ERP de niveau entreprise.*

---

## Sommaire

- PARTIE I — Vision, mission, valeurs
- PARTIE II — Architecture cible
- PARTIE III — Les 5 agents permanents
- PARTIE IV — Cycle officiel de développement
- PARTIE V — Normes de qualité
- PARTIE VI — Architecture ERP Core
- PARTIE VII — Comptabilité, Finance, Fiscalité
- PARTIE VIII — Temps réel et synchronisation
- PARTIE IX — Sécurité et Multi-tenant
- PARTIE X — Performance
- PARTIE XI — UX/UI
- PARTIE XII — IA MIAA
- PARTIE XIII — Déploiement
- PARTIE XIV — Certification
- PARTIE XV — Roadmap

---

## PARTIE I — Vision

Oraforme doit devenir un ERP complet.

- Chaque donnée métier ne doit exister qu'une seule fois.
- Chaque écran doit afficher une information cohérente.
- Les différences doivent être expliquées à l'utilisateur.

---

## PARTIE II — Architecture cible

```
UI
↓
API
↓
ERP Core
↓
Accounting Event Bus
↓
Supabase
↓
Realtime
↓
Tous les dashboards
```

**Interdictions absolues :**
- Calculs dupliqués
- INSERT directs dans plusieurs tables
- Sources de vérité multiples

---

## PARTIE III — Les cinq agents permanents

| Agent | Rôle |
|---|---|
| **A1 Architecte** | Protège la vision |
| **A2 Auditeur critique** | Cherche les incohérences |
| **A3 Investigateur** | Trouve la cause racine avec tous les outils (skills, plugins, MCP, SQL, Playwright, recherche) |
| **A4 Implémenteur** | Modifie uniquement après validation |
| **A5 Juge** | Valide ou rejette avec preuves |

---

## PARTIE IV — Cycle officiel de développement

```
1  Audit
2  Cause racine
3  Architecture
4  Implémentation
5  Tests unitaires
6  Tests fonctionnels
7  Tests visuels
8  Déploiement
9  Vérification production
10 Certification
11 Capitalisation
```

---

## PARTIE V — Règles absolues

- Aucun rapport sans preuves.
- Aucun PASS sans test.
- Chaque correction indique fichiers, lignes, impacts.
- Toute anomalie locale est corrigée immédiatement si sûre.
- Toute anomalie transverse devient un sprint.

---

## PARTIE VI — ERP Core

Tous les calculs passent par ERP Core :

- CA · TVA · CNSS · IRPP
- Trésorerie · Stocks · Achats
- Reporting · Analytics · Direction · Finance

> **Aucun écran ne recalcule ces données.**

---

## PARTIE VII — Cohérence métier

Pour chaque flux :

```
Facture → Comptabilité → Finance → Fiscalité → Audit → Reporting → Direction → MIAA
```

Tous doivent recevoir automatiquement le même événement.
Les différences HT/TTC doivent être expliquées.

---

## PARTIE VIII — Realtime

Toute création ou modification métier doit mettre à jour automatiquement les écrans concernés **sans rechargement manuel**.

---

## PARTIE IX — Fondations (ordre obligatoire)

Avant tout nouveau module :

| Code | Domaine |
|---|---|
| C001 | Authentification |
| C002 | Plans Entrepreneur / Business / Compagnie |
| C003 | Multi-tenant |
| C004 | Permissions |
| C005 | ERP Core |
| C006 | Event Bus |
| C007 | Realtime |
| C008 | Notifications |
| C009 | Workflow |
| C010 | MIAA |

---

## PARTIE X — Performance

| Cible | Seuil |
|---|---|
| API | < 300 ms |
| Propagation | < 2 s |
| Dashboard | < 1 s |

> Aucun chargement inutile.

---

## PARTIE XI — UX/UI

- Responsive desktop / tablette / mobile.
- Même design system partout.
- Explication visible lorsqu'un montant diffère.

---

## PARTIE XII — IA MIAA

Composant intelligent intégré à l'ERP Core.
Reçoit tous les événements métier via l'Event Bus.
Produit des alertes, recommandations et analyses proactives.

---

## PARTIE XIII — Déploiement

Chaque sprint :

1. Audit
2. Correction
3. Tests
4. Playwright
5. Build TypeScript
6. Déploiement Vercel
7. Validation utilisateur

---

## PARTIE XIV — Niveaux de certification

| Niveau | Critère |
|---|---|
| 🥉 Bronze | Fonctionne |
| 🥈 Argent | Cohérent |
| 🥇 Or | Testé en conditions réelles |
| 🏆 Platine | Robuste sur toute l'application |

---

## PARTIE XV — Backlog fondateur

**Priorité 1 — Fondations**
- Authentification · Plans · Multi-tenant · ERP Core · Event Bus

**Priorité 2 — Métier**
- Finance · Comptabilité · Fiscalité · RH · Stocks

**Priorité 3 — Intelligence**
- BI · MIAA · Reporting · Automatisation

---

## ANNEXE A — Checklist de livraison

Chaque livraison doit contenir :

- [ ] Audit
- [ ] Cause racine
- [ ] Correctif
- [ ] Tests
- [ ] SQL
- [ ] Playwright
- [ ] Déploiement
- [ ] Rapport
- [ ] Certification
