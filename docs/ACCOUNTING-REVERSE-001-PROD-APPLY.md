# ACCOUNTING-REVERSE-001 PROD APPLY

**Migration 187 NON appliquée.** Cette mission s'est arrêtée au contrôle
du canal d'écriture, avant toute tentative d'application, conformément à
la consigne explicite : « si l'application échoue : STOP, ne tente aucune
réparation improvisée ». Aucune donnée production modifiée. Aucun
commit/push.

## 1. Pre-check

Valeurs relevées en lecture seule, immédiatement avant la tentative
d'application (canal PostgREST, déjà établi comme sûr dans les missions
précédentes) :

| Élément | Valeur |
|---|---|
| Migration 187 présente localement | Oui — `supabase/migrations/187_fix_accounting_reverse_event_type.sql` (11 856 octets, modifiée 2026-10-06) |
| Projet production cible | `https://mrzixapnaqsbqmagivvf.supabase.co` (confirmé via `.env.local`, URL publique) |
| Signature actuelle de `fn_reverse_accounting_event` (RPC exposée) | `{p_event_id: uuid, p_reason: text, p_created_by: uuid}` — inchangée depuis le gate précédent |
| `accounting_events` (total) | **2** |
| `accounting_event_extournes` (total) | **0** |
| `event_type LIKE 'EXT-%'` | **0** |
| `event_type LIKE '%-EXT'` | **0** |
| `ONG-001` | **2** |

Valeurs identiques à celles du gate précédent
(`docs/ACCOUNTING-REVERSE-001-PREPROD-GATE.md` §3) — aucune donnée n'a
changé entre les deux missions.

## 2. Migration applied

**NON — bloquée au niveau du canal, pas du contenu de la migration.**

Deux canaux vérifiés, une seule fois chacun (pas de répétition inutile) :

- **MCP `postgres`** : `SELECT 1;` → `(ENOTFOUND) tenant/user
  postgres.mrzixapnaqsbqmagivvf not found`. Même échec, identique à toutes
  les vérifications précédentes de cet engagement — ce canal n'a jamais pu
  écrire (ni même lire) contre le projet Oraforme.
- **Supabase CLI** (`supabase projects list`) : **résultat nouveau et
  significatif** — le CLI répond avec succès (donc un jeton d'accès valide
  existe sur cette machine), mais liste exactement 3 projets :
  `BANKMOON` (`neudrlnjgtroxkeyspoe`), `AKS` (`uuzalfyiewewibpprpcc`),
  `MOONBANK-STAGING` (`wbamlgcucfgxynrtcwwg`) — **aucun n'est Oraforme**
  (`mrzixapnaqsbqmagivvf`). Ce compte/jeton CLI appartient visiblement à un
  engagement différent (MoonBank/AKS), sans rapport avec Oraforme.

**Décision prise — STOP, pas de tentative forcée** : lier le CLI
(`supabase link --project-ref mrzixapnaqsbqmagivvf`) sous un jeton qui ne
voit même pas ce projet dans sa propre liste aurait été une action à
l'aveugle, potentiellement sur un compte/organisation sans lien ni
autorisation confirmée avec Oraforme — exactement le type de « réparation
improvisée » que cette mission interdit. **Aucune tentative de lien, de
`db push`, ni d'exécution SQL n'a été faite.**

**Erreur** : absence de canal d'écriture autorisé et confirmé vers
`mrzixapnaqsbqmagivvf`, pas une erreur D'APPLICATION de la migration
elle-même (son contenu reste validé `READY` par le gate précédent).
**Étape** : avant même la première instruction de la migration (`BEGIN;`)
— rien n'a été envoyé au serveur de production.
**État avant/après** : identique (§1), confirmé par re-lecture des mêmes
comptages après la tentative (§6).

## 3. Function verification

Non applicable — la fonction n'a pas été modifiée. Signature actuelle
(RPC exposée, §1) : `fn_reverse_accounting_event(p_event_id uuid, p_reason
text, p_created_by uuid)` — **toujours l'ancienne version** (celle de la
migration 138, défaut `EXT-<module>-<numéro>` non corrigé en production).

## 4. Constraint verification

Non modifiée — confirmé indirectement par l'absence totale de changement
d'état (§1/§6). `chk_ae_event_type` n'a jamais été touchée par cette
mission (elle ne l'aurait pas été non plus si 187 avait pu s'appliquer,
voir le gate §1).

## 5. Control query

**Non exécutée** — la requête de contrôle intégrée à la migration
(`SELECT prosrc FROM pg_proc WHERE proname = 'fn_reverse_accounting_event';`,
attendu : contient `|| '-EXT'`) n'a de sens qu'après une application
réussie. Non inventée de test métier supplémentaire, conformément à la
consigne.

## 6. Production counts before/after

Identiques — aucune tentative d'écriture n'a eu lieu entre les deux
relevés :

| Mesure | Avant | Après |
|---|---|---|
| `accounting_events` | 2 | 2 |
| `accounting_event_extournes` | 0 | 0 |
| `event_type LIKE 'EXT-%'` | 0 | 0 |
| `event_type LIKE '%-EXT'` | 0 | 0 |

## 7. ONG-001 status

Les 2 événements `ONG-001` existants n'ont pas été lus au-delà du
comptage déjà fait dans le gate précédent — **aucune lecture
supplémentaire de leur contenu, aucune modification, aucune tentative de
reverse** (conforme à la consigne explicite « NE PAS les reverser »).
Leur nombre reste 2 avant et après cette mission (§6) — **inchangés**.

## 8. Data integrity

Aucune variation entre avant et après sur `accounting_events`,
`accounting_event_extournes` (§6). `journal_entries` et
`accounting_event_log` n'ont pas été recomptés séparément dans cette
mission précise (aucune action n'a eu lieu qui aurait pu les affecter —
recompter aurait été une vérification sans objet, puisqu'aucune écriture
n'a été tentée nulle part).

## 9. Production safety

```
PRODUCTION_BUSINESS_DATA_MODIFIED=NO
```
Aucune facture, vente, paiement, journal ou extourne créé/modifié/
supprimé. Aucun objet SQL de production modifié non plus (la migration
187 n'a pas pu être envoyée au serveur).

## 10. Rollback readiness

Sans objet — rien n'a été appliqué, donc rien à annuler. Le rollback
documenté dans la migration (restaurer le corps de la migration 138)
reste valide et inchangé pour une mission future, une fois 187
effectivement appliquée.

## 11. Final verdict

**`BLOCKED`** — non pas parce que la migration 187 serait incorrecte
(elle reste validée `READY` par le gate précédent et par le harness
local), mais parce qu'**aucun canal d'écriture confirmé et autorisé vers
le projet de production Oraforme n'est disponible dans cette session**.
Le jeton Supabase CLI actif ne voit pas ce projet ; le canal MCP postgres
échoue à l'identification du tenant. Appliquer la migration exigerait
soit (a) un jeton/CLI effectivement lié au compte/organisation propriétaire
de `mrzixapnaqsbqmagivvf`, soit (b) une correction de la configuration du
connecteur MCP `postgres` pour qu'il cible le bon projet — aucune des
deux actions n'est du ressort de cette session (ni autorisée par cette
mission, qui porte exclusivement sur l'APPLICATION, pas la réparation du
canal).

---

```
ACCOUNTING_REVERSE_PROD=BLOCKED
MIGRATION_187_APPLIED=NO
PRODUCTION_BUSINESS_DATA_MODIFIED=NO
CONTROL_QUERY=NOT_EXECUTED (dépend d'une application réussie, jamais atteinte)
ONG001_UNCHANGED=YES
UNEXPECTED_DATA_CHANGE=NONE
NEXT_RECOMMENDED_MISSION=Rétablir un canal d'écriture confirmé vers mrzixapnaqsbqmagivvf (lier le CLI Supabase sous le compte/organisation propriétaire du projet Oraforme, OU reconfigurer le connecteur MCP postgres avec la chaîne de connexion correcte pour ce projet) — une fois ce canal confirmé, répéter UNIQUEMENT les étapes 1 à 3 de cette mission (pre-check, application de 187, post-check), sans refaire le gate ni la validation locale déjà acquis.
```
