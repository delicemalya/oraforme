# ORAFORME ENGINEERING CONSTITUTION
**Version 1.0 — Constitution d'ingénierie (Fondations)**
Document directeur officiel du projet Oraforme.

---

## Préambule

Cette constitution définit la gouvernance technique, les règles d'architecture, les critères de qualité et le processus de développement du projet Oraforme.

> **Aucune fonctionnalité n'est considérée terminée sans respecter cette constitution.**

---

## Vision

Construire un ERP africain moderne, modulaire, intelligent et robuste.

- Une seule vérité métier.
- Un seul ERP Core.
- Un seul Event Bus.

---

## Principes non négociables

1. Toute correction commence par un audit.
2. Toute correction finit par des preuves.
3. Aucun rapport ne remplace un test.
4. Une seule logique métier.
5. Aucun calcul dupliqué.
6. Toute fonctionnalité est testée comme un utilisateur réel.

---

## Les 5 Agents

| Agent | Rôle |
|---|---|
| **Agent 1** | Architecte Produit |
| **Agent 2** | Auditeur Critique |
| **Agent 3** | Investigateur Technique |
| **Agent 4** | Ingénieur Implémentation |
| **Agent 5** | Juge Qualité |

---

## Cycle officiel

```
Audit → Cause racine → Validation d'architecture → Implémentation → Tests → Vérification visuelle → Déploiement → Certification
```

---

## Certifications

| Code | Domaine |
|---|---|
| C001 | Authentification |
| C002 | Plans |
| C003 | Multi-tenant |
| C004 | Permissions |
| C005 | ERP Core |
| C006 | ERP Event Bus |
| C007 | Realtime |
| C008 | Notifications |
| C009 | Workflow |
| C010 | MIAA |

---

## Validation obligatoire

Chaque intervention doit fournir :

- [ ] Cause racine identifiée
- [ ] Fichiers modifiés listés
- [ ] Tests automatisés
- [ ] Tests Playwright
- [ ] Vérification SQL
- [ ] Vérification visuelle
- [ ] Déploiement Vercel
- [ ] Verdict : **PASS** ou **REJETÉ**

---

## Feuille de route

Le projet repart des fondations sans réécrire l'existant.
Chaque composant sera audité, certifié et amélioré progressivement.
