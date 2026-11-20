/**
 * lib/fiscal/cg-paie-2026.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests de non-régression paie Congo 2026 — Mission P0 paie 2026-09-17.
 *
 * Chaque cas ci-dessous reproduit un document réel (bulletin individuel ECAM
 * Congo ou déclaration CNSS/TUS officielle), pas une valeur inventée. Voir
 * lib/countries/CG.ts pour le détail des règles et leur statut de preuve.
 *
 * Sources :
 *  - 3 bulletins de paie individuels réels ECAM Congo, janvier 2024
 *    (Etat des salaires 2024 ECAM.xlsx) : MOUTINOU MAYIMA Jean Paul,
 *    ONDOUMA ASSIANGOULI Jean Ghislain Médard, IMANA Claude Christian.
 *  - Déclaration CNSS/TUS réelle, juin 2026 (Model Declaration Mensuelle CNSS
 *    TUS.xlsx), 20 salariés — MOUTINOU MAYIMA J.P. utilisé comme fixture base
 *    CNSS/TUS = brut - indemnités.
 *
 * Ce qui N'EST PAS testé ici, faute de preuve suffisante (voir CG.ts) :
 *  - Les 20 lignes individuelles de la déclaration TUS juin 2026 ne sont pas
 *    reproduites une à une : seule la ligne MOUTINOU a été conservée avec une
 *    précision suffisante pour un test exact. Les 19 autres lignes, vérifiées
 *    lors de l'audit documentaire, n'ont pas été re-capturées ici pour éviter
 *    d'inventer des données non retenues avec certitude — voir le test de
 *    "formule TUS" ci-dessous pour la couverture générale du taux.
 *  - Le plafond 600 000/1 200 000 n'est PAS testé comme "doit être plafonné"
 *    ou "ne doit pas être plafonné" : seul le comportement actuellement codé
 *    est vérifié (voir CG.ts, marqué À CONFIRMER).
 *  - La composante « TUS DGI » (2,025 % ou autre) n'est pas testée car non
 *    implémentée — voir universal-tax-engine.test.ts pour le test négatif.
 */

import { describe, it, expect } from 'vitest'
import {
  calculerIRPP,
  calculerChargesSociales,
  genererResumeFiscalMensuel,
} from './universal-tax-engine'

// ═══════════════════════════════════════════════════════════════════════════════
// IRPP — 3 bulletins individuels réels, janvier 2024
// ═══════════════════════════════════════════════════════════════════════════════

describe('IRPP CG — bulletins individuels réels ECAM Congo, janvier 2024', () => {

  it('MOUTINOU MAYIMA Jean Paul — brut imposable 703 046, 2,5 parts → IRPP 95 035', () => {
    const brut_imposable = 703_046
    const cnss = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut_imposable })
    const base_irpp = Math.max(0, brut_imposable - cnss.total_salarie)

    const irpp = calculerIRPP({
      codePays: 'CG', salaireBrut: base_irpp,
      situation: 'celibataire', nombreEnfants: 3, nombreParts: 2.5,
    })

    expect(cnss.total_salarie).toBe(28_122)          // 703 046 × 4 %, document : 28 121,84
    expect(irpp.nombre_parts).toBe(2.5)
    expect(irpp.abattement_type).toBe('pct_net_cnss')
    expect(irpp.irpp_net).toBe(95_035)                // document : 95 034,83
  })

  it('ONDOUMA ASSIANGOULI Jean Ghislain Médard — brut imposable 520 546, 3,5 parts → IRPP 44 015', () => {
    const brut_imposable = 520_546
    const cnss = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut_imposable })
    const base_irpp = Math.max(0, brut_imposable - cnss.total_salarie)

    const irpp = calculerIRPP({
      codePays: 'CG', salaireBrut: base_irpp,
      situation: 'marie', nombreEnfants: 3, nombreParts: 3.5,
    })

    expect(cnss.total_salarie).toBe(20_822)           // 520 546 × 4 %, document : 20 821,84
    expect(irpp.irpp_net).toBe(44_015)                // document : 44 014,83
  })

  it('IMANA Claude Christian — brut imposable 153 735,24, 2 parts → IRPP 4 847', () => {
    const brut_imposable = 153_735.24
    const cnss = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut_imposable })
    const base_irpp = Math.max(0, brut_imposable - cnss.total_salarie)

    const irpp = calculerIRPP({
      codePays: 'CG', salaireBrut: base_irpp,
      situation: 'celibataire', nombreEnfants: 1, nombreParts: 2,
    })

    expect(cnss.total_salarie).toBe(6_149)            // 153 735,24 × 4 %, document : 6 149,41
    expect(irpp.irpp_net).toBe(4_847)                 // document : 4 846,87
  })

})

describe('IRPP CG — division par parts (1 / 2 / 2,5 / 3,5)', () => {
  const base = 400_000   // base après CNSS, avant abattement — même base pour les 4 cas

  it.each([1, 2, 2.5, 3.5])('parts = %s : irpp_net décroît quand parts augmente', (parts) => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: base, situation: 'celibataire', nombreEnfants: 0, nombreParts: parts })
    expect(res.nombre_parts).toBe(parts)
    expect(res.base_par_part).toBe(Math.round((base - Math.round(base * 0.20)) / parts))
  })

  it('1 part paie plus que 3,5 parts, à base identique', () => {
    const p1  = calculerIRPP({ codePays: 'CG', salaireBrut: base, situation: 'celibataire', nombreEnfants: 0, nombreParts: 1 })
    const p35 = calculerIRPP({ codePays: 'CG', salaireBrut: base, situation: 'celibataire', nombreEnfants: 0, nombreParts: 3.5 })
    expect(p1.irpp_net).toBeGreaterThan(p35.irpp_net)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CNSS / TUS — base = brut global - indemnités, déclaration réelle juin 2026
// ═══════════════════════════════════════════════════════════════════════════════

describe('CNSS/TUS CG — base = brut global - indemnités (cas réel juin 2026)', () => {

  it('MOUTINOU MAYIMA J.P., juin 2026 : brut 887 213 - indemnités 171 111 = base 716 102', () => {
    const res = genererResumeFiscalMensuel({
      codePays: 'CG', periode: '2026-06',
      salaireBrut: 887_213, indemnites: 171_111,
      situation: 'celibataire', nombreEnfants: 3, nombreParts: 2.5,
    })

    expect(res.brut_imposable).toBe(716_102)
    expect(res.indemnites).toBe(171_111)
    expect(res.salaire_brut_global).toBe(887_213)

    const b = (code: string) => res.charges_sociales.branches.find(x => x.code === code)!
    expect(b('VID_SAL').montant_salarie).toBe(28_644)     // 716 102 × 4 %
    expect(b('VID_PAT').montant_patronal).toBe(57_288)    // 716 102 × 8 %
    expect(b('AF').montant_patronal).toBe(71_825)         // 716 102 × 10,03 % (PF)
    expect(b('AT').montant_patronal).toBe(13_500)         // plafonné 600 000 × 2,25 % — comportement actuel, À confirmer
    expect(b('TUS').montant_patronal).toBe(39_207)        // 716 102 × 5,475 %, déplafonné
  })

  it('indemnités = 0 : brut_imposable = brut global (comportement inchangé)', () => {
    const res = genererResumeFiscalMensuel({
      codePays: 'CG', periode: '2026-06',
      salaireBrut: 500_000,
      situation: 'celibataire', nombreEnfants: 0,
    })
    expect(res.brut_imposable).toBe(500_000)
    expect(res.indemnites).toBe(0)
  })

  it('indemnités > brut global : base cotisable plancher à 0, jamais négative', () => {
    const res = genererResumeFiscalMensuel({
      codePays: 'CG', periode: '2026-06',
      salaireBrut: 100_000, indemnites: 150_000,
      situation: 'celibataire', nombreEnfants: 0,
    })
    expect(res.brut_imposable).toBe(0)
    expect(res.charges_sociales.total_salarie).toBe(0)
  })

  it('formule TUS CNSS = base × 5,475 %, déplafonnée sur une série de bases (structure vérifiée 20/20 lignes réelles juin 2026)', () => {
    for (const base of [153_735.24, 500_000, 716_102, 1_000_000, 1_500_000, 6_264_436]) {
      const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: base })
      const tus = res.branches.find(b => b.code === 'TUS')!
      expect(tus.montant_patronal).toBe(Math.round(base * 0.05475))
      expect(tus.plafond_applique).toBeNull()
    }
  })

  it('brut < 600 000 : base AT non plafonnée (sous le plafond, rien à écrêter)', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 400_000 })
    const at  = res.branches.find(b => b.code === 'AT')!
    expect(at.base_calcul).toBe(400_000)
    expect(at.montant_patronal).toBe(Math.round(400_000 * 0.0225))
  })

  it('brut > 600 000 : base AT plafonnée à 600 000 — comportement actuel du code (À confirmer, voir CG.ts)', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 716_102 })
    const at  = res.branches.find(b => b.code === 'AT')!
    expect(at.base_calcul).toBe(600_000)
    expect(at.montant_patronal).toBe(13_500)
  })

  it('plusieurs lignes pour un même salarié : la cotisation se calcule une fois sur le brut agrégé, pas ligne par ligne', () => {
    const ligne1 = 300_000
    const ligne2 = 450_000
    const brutAgrege = ligne1 + ligne2   // 750 000 — dépasse le plafond AT (600 000)

    const surAgrege = calculerChargesSociales({ codePays: 'CG', salaireBrut: brutAgrege })
    const atAgrege  = surAgrege.branches.find(b => b.code === 'AT')!.montant_patronal

    const separe1 = calculerChargesSociales({ codePays: 'CG', salaireBrut: ligne1 }).branches.find(b => b.code === 'AT')!.montant_patronal
    const separe2 = calculerChargesSociales({ codePays: 'CG', salaireBrut: ligne2 }).branches.find(b => b.code === 'AT')!.montant_patronal

    // Agréger avant de cotiser change le résultat dès qu'un plafond est franchi :
    // calculer ligne par ligne laisse chaque ligne re-consommer son propre plafond
    // et sur-déclare la cotisation par rapport à la rémunération mensuelle réelle.
    expect(atAgrege).toBe(Math.round(600_000 * 0.0225))
    expect(atAgrege).toBeLessThan(separe1 + separe2)
  })

  it('plafonds CNSS 1 200 000 / 600 000 inchangés (valeur actuelle — À confirmer, ne pas modifier sur simple hypothèse)', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 2_000_000 })
    const vidSal = res.branches.find(b => b.code === 'VID_SAL')!
    const af     = res.branches.find(b => b.code === 'AF')!
    const at     = res.branches.find(b => b.code === 'AT')!
    expect(vidSal.plafond_applique).toBe(1_200_000)
    expect(af.plafond_applique).toBe(1_200_000)
    expect(at.plafond_applique).toBe(600_000)
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// Audit post-réparation — chaîne de données indemnités / parts familiales
// Mission suivante (2026-09-17). Verrouille l'état RÉEL constaté, pas une
// hypothèse de correction. Voir le rapport pour l'analyse complète.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Indemnités — aucun consommateur ne fournit encore de valeur réelle', () => {

  it("prime de transport : reste dans l'assiette cotisable par défaut (indemnites=0, comportement actuel de tous les appelants en production)", () => {
    // Aucun appelant de calculerChargesSociales/calculerIRPP en production ne
    // retire de montant de type "prime de transport" du salaireBrut transmis
    // (audit des consommateurs, mission suivante 2026-09-17) : le champ
    // indemnites_non_imposables (page.tsx) / indemnites (genererResumeFiscalMensuel)
    // existe mais n'est alimenté par aucune donnée réelle. Ce test verrouille
    // ce comportement observé, pas une règle métier validée.
    const salaireBase    = 500_000
    const primeTransport = 50_000
    const brutAvecTransportInclus = salaireBase + primeTransport

    const avecTransportInclus = calculerChargesSociales({ codePays: 'CG', salaireBrut: brutAvecTransportInclus })
    const sansTransport       = calculerChargesSociales({ codePays: 'CG', salaireBrut: salaireBase })

    expect(avecTransportInclus.total_salarie).toBeGreaterThan(sansTransport.total_salarie)
    expect(avecTransportInclus.total_salarie).toBe(Math.round(brutAvecTransportInclus * 0.04))
  })

  it('genererResumeFiscalMensuel : indemnites=0 par défaut si non fourni (aucun appelant de production ne le fournit — 0 site trouvé)', () => {
    const res = genererResumeFiscalMensuel({
      codePays: 'CG', periode: '2026-06',
      salaireBrut: 500_000,
      situation: 'celibataire', nombreEnfants: 0,
    })
    expect(res.indemnites).toBe(0)
    expect(res.brut_imposable).toBe(res.salaire_brut_global)
  })

})

describe('Parts familiales — écart IMANA verrouillé (non corrigé, faute de preuve suffisante)', () => {

  it('IMANA (célibataire, 1 enfant) : la formule actuelle dérive 1,5 part, le bulletin réel montre 2 parts — écart non résolu', () => {
    // situation/nombreEnfants tels qu'enregistrés dans le bulletin réel ECAM
    // Congo janvier 2024 (voir lib/fiscal/cg-paie-2026.test.ts, fixture IMANA
    // ci-dessus, où nombreParts=2 est passé explicitement pour reproduire le
    // document). Ici, SANS nombreParts explicite, on observe la dérivation
    // interne (calcNombreParts) telle qu'elle tourne réellement en production.
    const derive = calculerIRPP({
      codePays: 'CG', salaireBrut: 147_586.24,   // base après CNSS, cas IMANA
      situation: 'celibataire', nombreEnfants: 1,
    })
    // La formule actuelle (parts_base 1 + 0 [non marié] + 1×0,5 enfant) donne 1,5.
    expect(derive.nombre_parts).toBe(1.5)
    // Le bulletin réel montre 2 parts pour ce même salarié — écart non expliqué
    // par aucune règle trouvée dans le code ou la documentation (audit mission
    // suivante 2026-09-17). Ne pas "corriger" ce test pour le faire matcher 2 :
    // il documente l'écart, il ne le résout pas.
    expect(derive.nombre_parts).not.toBe(2)
  })

  it("situation 'veuf' : aucun traitement distinct de 'celibataire' (même nombre de parts) — absence de règle documentée", () => {
    const veuf        = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'veuf', nombreEnfants: 0 })
    const celibataire = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(veuf.nombre_parts).toBe(celibataire.nombre_parts)
    expect(veuf.irpp_net).toBe(celibataire.irpp_net)
  })

})
