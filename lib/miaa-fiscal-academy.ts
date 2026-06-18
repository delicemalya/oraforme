// MIAA+ Academy Fiscale — modules pédagogiques par pays
// Données importées exclusivement depuis les moteurs Phase 1 — zéro duplication

import { FISCALITE_CONGO_2026 }                          from './fiscalite-congo'
import { FISCALITE_CAMEROUN_2023, PATENTE_CAMEROUN }     from './fiscalite-cameroun'
import {
  TAUX_IS     as IS_GA,
  TAUX_TVA    as TVA_GA,
  TAUX_PATENTE as PATENTE_GA,
  TAUX_IRVM   as IRVM_GA,
}                                                         from './fiscalite-gabon'
import {
  TAUX_IS      as IS_TD,
  TAUX_TVA     as TVA_TD,
  TAUX_PATENTE as PATENTE_TD,
  REGLES_DEDUCTIBILITE as DEDUCT_TD,
}                                                         from './fiscalite-tchad'
import {
  TAUX_IS            as IS_CF,
  TAUX_TVA           as TVA_CF,
  AUTRES_PRELEVEMENTS as PREL_CF,
}                                                         from './fiscalite-rca'
import {
  TAUX_IS      as IS_GQ,
  TAUX_TVA     as TVA_GQ,
  TRANCHES_IRPP_GQ,
}                                                         from './fiscalite-guinee-equatoriale'
import {
  TAUX_IS       as IS_CD,
  TAUX_TVA      as TVA_CD,
  IPR_RDC,
  IERE_RDC,
  IM_RDC,
}                                                         from './fiscalite-rdc'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface AcademyModule {
  id: string
  titre: string
  pays: string
  niveau: 'debutant' | 'intermediaire' | 'avance'
  contenu: string
  exempleChiffre?: string
  piegesFrequents?: string[]
  sourceReglementaire?: string
}

// ── Valeurs dérivées pour les contenus (calculées depuis les imports) ─────────

const CG    = FISCALITE_CONGO_2026
const CM    = FISCALITE_CAMEROUN_2023

const pct   = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`
const fcfa  = (v: number) => v.toLocaleString('fr-FR') + ' FCFA'
const cdf   = (v: number) => v.toLocaleString('fr-FR') + ' FC'

// ── Modules par pays ──────────────────────────────────────────────────────────

export const FISCAL_ACADEMY: Record<string, AcademyModule[]> = {

  // ══════════════════ CONGO-BRAZZAVILLE (7 modules) ══════════════════════════

  CG: [
    {
      id: 'cg-tva-base',
      titre: 'Comprendre la TVA au Congo',
      pays: 'Congo-Brazzaville',
      niveau: 'debutant',
      contenu:
        `La TVA (Taxe sur la Valeur Ajoutée) est le principal impôt indirect au Congo-Brazzaville. Son taux normal est de ${pct(CG.tva.taux_normal)}, auquel s'ajoute un Centime Additionnel (CA) de ${pct(CG.tva.taux_ca)}. Le taux effectif appliqué sur le montant hors taxes est donc de ${pct(CG.tva.taux_effectif_ht, 1)}.

Seules les entreprises dont le chiffre d"affaires annuel hors taxes dépasse ${fcfa(CG.tva.seuil_assujettissement)} sont assujetties à la TVA. En dessous de ce seuil, l'entreprise n"est pas redevable de la TVA mais ne peut pas non plus la récupérer sur ses achats.

La TVA collectée (sur les ventes) est reversée à l"État après déduction de la TVA déductible (sur les achats professionnels). Seule la différence — la TVA nette — est à verser. Si la TVA déductible dépasse la TVA collectée, l'entreprise dispose d"un crédit de TVA reportable.`,
      exempleChiffre:
        `Ventes HT : 1 000 000 FCFA → TVA collectée : ${Math.round(1_000_000 * CG.tva.taux_effectif_ht).toLocaleString('fr-FR')} FCFA (${pct(CG.tva.taux_effectif_ht, 1)}) → TTC : ${(1_000_000 + Math.round(1_000_000 * CG.tva.taux_effectif_ht)).toLocaleString('fr-FR')} FCFA`,
      piegesFrequents: [
        `Appliquer ${pct(CG.tva.taux_normal)} au lieu de ${pct(CG.tva.taux_effectif_ht, 1)} en oubliant le Centime Additionnel`,
        "Déduire la TVA sur des achats personnels (non liés à l'activité)",
        'Ne pas conserver les factures fournisseurs — pièces justificatives obligatoires',
      ],
      sourceReglementaire: 'Art. confirmé LF 2026 — CGI Congo',
    },

    {
      id: 'cg-tva-declaration',
      titre: 'Déclarer sa TVA mensuelle au Congo',
      pays: 'Congo-Brazzaville',
      niveau: 'intermediaire',
      contenu:
        `La déclaration de TVA au Congo est mensuelle. Elle doit être déposée et réglée ${CG.tva.echeance_declaration}. Même si vous n'avez aucune opération, la déclaration "néant" est obligatoire.

Le formulaire de déclaration distingue la TVA collectée (sur les factures émises) et la TVA déductible (sur les factures reçues). La TVA nette à payer est le solde : collectée − déductible.

En cas de retard, les pénalités sont sévères : une majoration de ${pct(CG.penalites.tva_retard_majoration)} du montant dû, plus des intérêts de ${pct(CG.penalites.tva_retard_interet_mensuel)}/mois. Pour un montant de 500 000 FCFA, un mois de retard coûte 25 000 FCFA de pénalité fixe + 7 500 FCFA d'intérêts.`,
      exempleChiffre:
        `Ventes HT du mois : 5 000 000 FCFA → TVA collectée : ${Math.round(5_000_000 * CG.tva.taux_effectif_ht).toLocaleString('fr-FR')} FCFA\nAchats HT du mois : 2 000 000 FCFA → TVA déductible : ${Math.round(2_000_000 * CG.tva.taux_effectif_ht).toLocaleString('fr-FR')} FCFA\nTVA nette à verser : ${Math.round((5_000_000 - 2_000_000) * CG.tva.taux_effectif_ht).toLocaleString('fr-FR')} FCFA`,
      piegesFrequents: [
        'Oublier de déclarer les mois sans opération (déclaration néant obligatoire)',
        'Confondre la date limite (avant le 20, pas le 31 du mois suivant)',
        'Ne pas imputer les crédits de TVA des mois précédents',
      ],
      sourceReglementaire: `CGI Congo — délai : ${CG.tva.echeance_declaration}`,
    },

    {
      id: 'cg-is-base',
      titre: "Comprendre l'IS au Congo",
      pays: 'Congo-Brazzaville',
      niveau: 'debutant',
      contenu:
        `L'Impôt sur les Sociétés (IS) au Congo est calculé au taux de ${pct(CG.is.taux_standard)} sur le bénéfice net imposable. Le bénéfice net imposable correspond au résultat comptable corrigé des réintégrations et déductions fiscales.

Particularité importante : il existe un minimum de perception de ${pct(CG.is.minimum_ca)} du chiffre d'affaires hors taxes. Cela signifie que même en cas de bénéfice faible ou nul, l'entreprise paie au moins ${pct(CG.is.minimum_ca)} de son CA en IS. Ce minimum protège le Trésor contre les déclarations de déficit abusives.

Si l"IS calculé sur le bénéfice (30% × bénéfice) est inférieur au minimum (1% × CA), c'est le minimum qui s"applique. L'entreprise paie le montant le plus élevé des deux.`,
      exempleChiffre:
        `Scénario : CA = 200 000 000 FCFA, Bénéfice net = 5 000 000 FCFA\n` +
        `IS normal : ${pct(CG.is.taux_standard)} × 5 000 000 = 1 500 000 FCFA\n` +
        `IS minimum : ${pct(CG.is.minimum_ca)} × 200 000 000 = 2 000 000 FCFA\n` +
        `→ A PAYER : 2 000 000 FCFA (le minimum est supérieur)`,
      piegesFrequents: [
        'Ignorer le minimum de perception (1% CA) quand le bénéfice est faible',
        'Confondre bénéfice comptable et bénéfice fiscal (réintégrations = frais non déductibles)',
        'Omettre les charges non déductibles : amendes, pénalités, dépenses personnelles',
      ],
      sourceReglementaire: 'CGI Congo — confirmé LF 2026 sans modification',
    },

    {
      id: 'cg-is-minimum',
      titre: 'IS minimum et acomptes trimestriels',
      pays: 'Congo-Brazzaville',
      niveau: 'intermediaire',
      contenu:
        `L"IS congolais ne se règle pas uniquement en fin d"année. Il existe un système d"acomptes trimestriels, chacun égal à ${pct(CG.is.acompte_trimestriel)} de l"IS de l"exercice précédent (IS N-1). Ces 4 acomptes de 25% couvrent théoriquement l'IS de l"année courante.

Si l"IS réel de l"année (N) s"avère supérieur aux acomptes versés, la différence (solde) est due lors du dépôt de la déclaration annuelle. Si les acomptes sont supérieurs à l'IS réel, l"excédent peut être imputé sur les exercices suivants.

Le non-paiement des acomptes déclenche une majoration de ${pct(CG.penalites.is_retard_majoration)} + intérêts de ${pct(CG.penalites.is_retard_interet_mensuel)}/mois. Il est donc crucial de prévoir ces décaissements dans la trésorerie.`,
      exempleChiffre:
        `IS N-1 payé : 4 000 000 FCFA → 4 acomptes de 1 000 000 FCFA chacun (${pct(CG.is.acompte_trimestriel)} × 4 000 000)\nSi IS réel N = 5 000 000 FCFA → solde à payer en fin d'exercice : 1 000 000 FCFA`,
      piegesFrequents: [
        "Oublier les acomptes trimestriels et devoir payer tout l'IS en une fois",
        'Baser les acomptes sur N-2 au lieu de N-1',
        'Ne pas déduire les acomptes versés du solde final',
      ],
      sourceReglementaire: 'CGI Congo — art. IS, confirmé LF 2026',
    },

    {
      id: 'cg-patente',
      titre: 'La Patente : calcul et échéance',
      pays: 'Congo-Brazzaville',
      niveau: 'debutant',
      contenu:
        `La Patente est une taxe professionnelle annuelle due par toutes les entreprises et commerçants congolais. Elle est calculée sur le chiffre d'affaires annuel hors taxes de l'exercice précédent selon un barème dégressif à 8 tranches.

Le taux est maximal pour les petites structures (${pct(CG.patente.tranches[0].taux, 4)} pour CA ≤ 5 000 000 FCFA, minimum ${fcfa(CG.patente.tranches[0].minimum!)}) et diminue progressivement pour atteindre ${pct(CG.patente.tranches[CG.patente.tranches.length - 1].taux, 5)} pour les très grandes entreprises.

La Patente doit être déclarée et payée ${CG.patente.echeance}. Le non-respect de cette échéance expose à des pénalités et peut bloquer certaines démarches administratives (renouvellement de contrats publics, etc.).`,
      exempleChiffre:
        `CA annuel HT = 50 000 000 FCFA (tranche 30M-60M à ${pct(CG.patente.tranches[2].taux, 2)})\nPatente = ${pct(CG.patente.tranches[2].taux, 2)} × 50 000 000 = ${(50_000_000 * CG.patente.tranches[2].taux).toLocaleString('fr-FR')} FCFA`,
      piegesFrequents: [
        'Calculer la patente sur le CA TTC au lieu du CA HT',
        'Oublier la date limite du 31 mars',
        'Ne pas appliquer le minimum de 97 500 FCFA pour les CA ≤ 5 000 000 FCFA',
      ],
      sourceReglementaire: `CGI Congo — Patente — ${CG.patente.echeance}`,
    },

    {
      id: 'cg-irpp',
      titre: "L'IRPP et les tranches au Congo",
      pays: 'Congo-Brazzaville',
      niveau: 'intermediaire',
      contenu:
        `L'IRPP (Impôt sur le Revenu des Personnes Physiques) est prélevé sur les salaires selon un barème progressif à 5 tranches. Un abattement professionnel de ${pct(CG.irpp.abattement_professionnel)} est appliqué sur le salaire brut avant calcul : il représente les charges professionnelles forfaitaires.

Les 5 tranches s'appliquent à la rémunération nette annuelle après abattement : ${CG.irpp.tranches.map(t => `${t.taux === 0 ? '0%' : pct(t.taux)} de 0 à ${t.max === Infinity ? '∞' : fcfa(t.max)}`).join(' — ')}.

Important : depuis la LF 2026, l"État congolais prend en charge l"IRPP des salariés (mesure de pouvoir d"achat). L'employeur doit quand même calculer l"IRPP pour la déclaration, mais il ne le déduit pas du salaire du salarié.`,
      exempleChiffre:
        `Salaire brut mensuel : 1 200 000 FCFA\nBase après abattement ${pct(CG.irpp.abattement_professionnel)} : 960 000 FCFA\nIRPP mensuel :\n- 0 — 464 000 FCFA : 0%\n- 464 001 — 960 000 FCFA (496 000 FCFA) × 1% = 4 960 FCFA\nIRPP mensuel total : 4 960 FCFA (pris en charge État en 2026)`,
      piegesFrequents: [
        "Oublier l'abattement professionnel de 20% avant calcul",
        'Appliquer le taux marginal supérieur à toute la rémunération (pas un taux moyen global)',
        "Continuer à déduire l'IRPP du salaire net en 2026 alors que l'État le prend en charge",
      ],
      sourceReglementaire: 'Art. 76 CGI Congo — LF 2026 (mesure prise en charge)',
    },

    {
      id: 'cg-cnss',
      titre: 'CNSS : cotisations employeur et salarié',
      pays: 'Congo-Brazzaville',
      niveau: 'debutant',
      contenu:
        `La CNSS (Caisse Nationale de Sécurité Sociale) collecte les cotisations sociales. La part salariale est de ${pct(CG.cnss.taux_salarie)}, prélevée sur le salaire brut mais plafonnée à ${fcfa(CG.cnss.plafond_mensuel_salarie)} par mois (= 6 × SMIG). Au-delà de ce plafond, le salarié ne cotise plus.

La part patronale comprend plusieurs composantes : retraite (${pct(CG.cnss.taux_retraite_patronal)}), accidents du travail (${pct(CG.cnss.taux_at_patronal)}), allocations familiales (${pct(CG.cnss.taux_af_patronal)}), pécule (${pct(CG.cnss.taux_pecule_patronal, 2)}), soit un total CNSS patronal de ${pct(CG.cnss.total_cnss_patronal, 2)}.

En plus du CNSS patronal, l"employeur verse également la TUS (Taxe d'Usage Social) de ${pct(CG.cnss.taux_tus)}. Cette taxe est comptabilisée séparément en compte 643. Le total patronal avec TUS est donc de ${pct(CG.cnss.total_patronal_avec_tus, 2)}. Comme l"IRPP, la LF 2026 prévoit la prise en charge des cotisations patronales par l'État (mesure temporaire).`,
      exempleChiffre:
        `Salaire brut : 1 000 000 FCFA (supérieur au plafond ${fcfa(CG.cnss.plafond_mensuel_salarie)})\nCNSS salarié : ${pct(CG.cnss.taux_salarie)} × ${fcfa(CG.cnss.plafond_mensuel_salarie)} (plafond) = ${Math.round(CG.cnss.plafond_mensuel_salarie * CG.cnss.taux_salarie).toLocaleString('fr-FR')} FCFA\nCNSS patronal : ${pct(CG.cnss.total_cnss_patronal, 2)} × 1 000 000 = ${Math.round(1_000_000 * CG.cnss.total_cnss_patronal).toLocaleString('fr-FR')} FCFA\nTUS : ${pct(CG.cnss.taux_tus)} × 1 000 000 = ${Math.round(1_000_000 * CG.cnss.taux_tus).toLocaleString('fr-FR')} FCFA`,
      piegesFrequents: [
        `Ne pas appliquer le plafond de ${fcfa(CG.cnss.plafond_mensuel_salarie)} pour la part salariale`,
        'Oublier la TUS (3%) dans les charges patronales',
        'Confondre le taux CNSS seul (20,29%) avec le total avec TUS (23,29%)',
      ],
      sourceReglementaire: `LF 2026 — CNSS Congo (décomposition : ${pct(CG.cnss.total_cnss_patronal, 2)} + TUS ${pct(CG.cnss.taux_tus)})`,
    },
  ],

  // ══════════════════ CAMEROUN (5 modules) ═══════════════════════════════════

  CM: [
    {
      id: 'cm-tva-base',
      titre: `La TVA au Cameroun (${pct(CM.tva.taux_effectif * 100 === 19.25 ? CM.tva.taux_effectif : CM.tva.taux_effectif, 2)})`,
      pays: 'Cameroun',
      niveau: 'debutant',
      contenu:
        `La TVA au Cameroun est appliquée au taux officiel de ${pct(CM.tva.taux_effectif, 2)}. Ce taux est composé d'un taux de base de 17,25% auquel s'ajoutent les Centimes Additionnels Communaux (CAC) représentant 10% de la TVA, ce qui donne le taux effectif de ${pct(CM.tva.taux_effectif, 2)}.

Les exportations bénéficient du taux zéro : elles sont exonérées de TVA mais l'exportateur peut récupérer la TVA déductible sur ses achats. La déclaration est mensuelle avec un délai au ${CM.tva.echeance_declaration}.

Les entreprises en régime simplifié (PME) peuvent être soumises à un régime forfaitaire selon leur taille. Il convient de vérifier son régime auprès de la DGI Cameroun.`,
      exempleChiffre:
        `Vente HT : 1 000 000 FCFA → TVA ${pct(CM.tva.taux_effectif, 2)} : ${Math.round(1_000_000 * CM.tva.taux_effectif).toLocaleString('fr-FR')} FCFA → TTC : ${(1_000_000 + Math.round(1_000_000 * CM.tva.taux_effectif)).toLocaleString('fr-FR')} FCFA`,
      piegesFrequents: [
        `Utiliser 17,25% au lieu du taux officiel ${pct(CM.tva.taux_effectif, 2)}`,
        'Oublier que les exportations sont à taux zéro (pas exonérées — différence importante pour la déductibilité)',
        'Dépasser le délai du 15 du mois suivant',
      ],
      sourceReglementaire: 'Central Africa Tax Guide 2023 — à vérifier vs LF 2026',
    },

    {
      id: 'cm-is-pme',
      titre: 'IS Cameroun : taux et régimes',
      pays: 'Cameroun',
      niveau: 'intermediaire',
      contenu:
        `L"Impôt sur les Sociétés (IS) au Cameroun s'applique sur le bénéfice net imposable des entreprises. Le taux général est de 30% pour les grandes entreprises. Les PME et moyennes entreprises peuvent bénéficier d"un taux réduit selon leur chiffre d'affaires — cette distinction est établie par le Code Général des Impôts camerounais.

Les entreprises de petite taille peuvent être soumises au régime simplifié ou au régime de l"impôt libératoire selon leur niveau d'activité. Le passage d"un régime à l'autre dépend du franchissement des seuils de CA définis par la DGI Cameroun.

Attention : les données de taux IS Cameroun sont issues du Tax Guide 2023. Il est recommandé de confirmer les taux applicables auprès de la DGI Cameroun pour l'exercice en cours, notamment suite à la LF 2026.`,
      piegesFrequents: [
        'Appliquer le taux GE (30%) à une PME éligible au taux réduit',
        'Ne pas distinguer bénéfice comptable (résultat net) et bénéfice fiscal (après réintégrations)',
        'Oublier les acomptes IS trimestriels',
      ],
      sourceReglementaire: 'Central Africa Tax Guide 2023 — ⚠️ À vérifier vs LF 2026 Cameroun',
    },

    {
      id: 'cm-patente',
      titre: 'Patente Cameroun : PE/ME/GE',
      pays: 'Cameroun',
      niveau: 'debutant',
      contenu:
        `La Patente au Cameroun est calculée selon 3 tranches correspondant à la taille de l'entreprise, mesurée par le chiffre d'affaires annuel hors taxes :

— Petites Entreprises (PE) : CA ≤ 50 000 000 FCFA → taux de ${pct(PATENTE_CAMEROUN.tranches[0].taux, 3)}\n— Moyennes Entreprises (ME) : CA de 50 000 001 à 3 000 000 000 FCFA → taux de ${pct(PATENTE_CAMEROUN.tranches[1].taux, 3)}\n— Grandes Entreprises (GE) : CA > 3 000 000 000 FCFA → taux de ${pct(PATENTE_CAMEROUN.tranches[2].taux, 3)}

La patente est due avant le ${CM.patente.echeance}. Le défaut de déclaration expose à des majorations et peut compliquer les relations avec les administrations publiques.`,
      exempleChiffre:
        `CA : 30 000 000 FCFA (PE) → Patente : ${pct(PATENTE_CAMEROUN.tranches[0].taux, 3)} × 30 000 000 = ${Math.round(30_000_000 * PATENTE_CAMEROUN.tranches[0].taux).toLocaleString('fr-FR')} FCFA`,
      piegesFrequents: [
        'Appliquer la tranche ME à une PE (CA ≤ 50M FCFA)',
        `Manquer l'échéance du ${CM.patente.echeance}`,
        'Calculer sur le CA TTC au lieu du CA HT',
      ],
      sourceReglementaire: `Central Africa Tax Guide 2023 — ${CM.patente.echeance}`,
    },

    {
      id: 'cm-cac',
      titre: 'Centimes Additionnels Communaux (CAC)',
      pays: 'Cameroun',
      niveau: 'intermediaire',
      contenu:
        `Les Centimes Additionnels Communaux (CAC) sont une particularité fiscale camerounaise. Ils représentent ${pct(CM.irpp.centimes_additionnels_com)} du montant de l'IRPP calculé et viennent s'y ajouter systématiquement.

Les CAC s"appliquent également sur la TVA : c'est eux qui font passer le taux TVA de 17,25% (base) à ${pct(CM.tva.taux_effectif, 2)} (taux officiel). De même pour l"IRPP : après calcul des tranches progressives, on ajoute 10% du résultat pour obtenir l'IRPP total.

Ces centimes additionnels sont reversés aux communes et constituent leur principale ressource fiscale. Pour les logiciels comptables, il est important de les paramétrer correctement afin d'éviter des sous-déclarations.`,
      exempleChiffre:
        `IRPP brut calculé sur tranches : 100 000 FCFA\nCAC (${pct(CM.irpp.centimes_additionnels_com)}) : 10 000 FCFA\nIRPP total à verser : 110 000 FCFA`,
      piegesFrequents: [
        "Oublier les CAC dans les bulletins de paie — sous-évaluation systématique de l'IRPP",
        'Confondre les CAC TVA (inclus dans les 19,25%) et les CAC IRPP (en sus)',
        "Déclarer l'IRPP sans les CAC → risque de contrôle fiscal",
      ],
      sourceReglementaire: 'Central Africa Tax Guide 2023 — CGI Cameroun',
    },

    {
      id: 'cm-irpp',
      titre: "L'IRPP au Cameroun : 4 tranches",
      pays: 'Cameroun',
      niveau: 'intermediaire',
      contenu:
        `L'IRPP camerounais est progressif à ${CM.irpp.tranches.length} tranches appliquées au revenu annuel imposable. Les tranches sont : ${CM.irpp.tranches.map(t => `${pct(t.taux)} jusqu'à ${t.max === Infinity ? '+∞' : fcfa(t.max)}`).join(' ; ')}.

Après le calcul sur les tranches, les Centimes Additionnels Communaux (${pct(CM.irpp.centimes_additionnels_com)}) sont ajoutés au montant obtenu. C'est donc l'IRPP total = IRPP brut × (1 + ${pct(CM.irpp.centimes_additionnels_com)}).

Contrairement au Congo, il n'y existe pas de mesure de prise en charge par l'État pour 2026 au Cameroun. L'IRPP reste entièrement à la charge du salarié via retenue à la source mensuelle par l'employeur.`,
      exempleChiffre:
        `Revenu annuel imposable : 4 500 000 FCFA\n— 0 → 2 000 000 : ${pct(CM.irpp.tranches[0].taux)} × 2 000 000 = 200 000 FCFA\n— 2 000 001 → 3 000 000 : ${pct(CM.irpp.tranches[1].taux)} × 1 000 000 = 150 000 FCFA\n— 3 000 001 → 4 500 000 : ${pct(CM.irpp.tranches[2].taux)} × 1 500 000 = 375 000 FCFA\nIRPP brut : 725 000 FCFA + CAC ${pct(CM.irpp.centimes_additionnels_com)} = 797 500 FCFA`,
      piegesFrequents: [
        'Oublier les CAC en fin de calcul',
        "Calculer l'IRPP sur le salaire brut sans retrancher les charges sociales déductibles",
        'Appliquer un taux moyen global au lieu du barème progressif',
      ],
      sourceReglementaire: 'Central Africa Tax Guide 2023 — ⚠️ À vérifier vs LF 2026 Cameroun',
    },
  ],

  // ══════════════════ GABON (5 modules) ══════════════════════════════════════

  GA: [
    {
      id: 'ga-is-base',
      titre: "L'IS au Gabon : 35% + minimum 1,1% CA",
      pays: 'Gabon',
      niveau: 'debutant',
      contenu:
        `L'IS gabonais est de ${pct(IS_GA.taux_normal)} sur le bénéfice net imposable. C'est l'un des taux les plus élevés de la zone CEMAC. Un minimum de perception s'applique : max(${pct(IS_GA.taux_normal)} × bénéfice, ${pct(IS_GA.taux_minimum_ca)} × CA HT, plancher ${IS_GA.plancher_minimum.toLocaleString('fr-FR')} XAF).

Avantage important : les entreprises en création bénéficient d'une exonération du minimum de perception pendant leurs ${IS_GA.exoneration_minimum_annees} premières années d'activité. Durant cette période, seul l'IS normal (${pct(IS_GA.taux_normal)} × bénéfice) est dû.

Le régime des acomptes gabonais est différent des autres pays CEMAC : deux acomptes (pas quatre) sont prélevés en cours d'année sur la base de l'IS N-1.`,
      exempleChiffre:
        `CA : 100 000 000 XAF, Bénéfice : 3 000 000 XAF\nIS normal : ${pct(IS_GA.taux_normal)} × 3 000 000 = 1 050 000 XAF\nIS minimum (${pct(IS_GA.taux_minimum_ca)} CA) : ${Math.round(100_000_000 * IS_GA.taux_minimum_ca).toLocaleString('fr-FR')} XAF → plancher : ${IS_GA.plancher_minimum.toLocaleString('fr-FR')} XAF\n→ A PAYER : ${Math.round(100_000_000 * IS_GA.taux_minimum_ca).toLocaleString('fr-FR')} XAF (minimum supérieur)`,
      piegesFrequents: [
        `Ignorer le minimum de ${pct(IS_GA.taux_minimum_ca)} CA et le plancher de ${IS_GA.plancher_minimum.toLocaleString('fr-FR')} XAF`,
        "Ne pas bénéficier de l'exonération minimum les 2 premières années",
        'Confondre les 2 acomptes gabonais avec les 4 acomptes trimestriels du Congo',
      ],
      sourceReglementaire: 'DGI Gabon — Central Africa Tax Guide (nov 2023)',
    },

    {
      id: 'ga-acomptes',
      titre: 'Acomptes IS Gabon : calendrier des versements',
      pays: 'Gabon',
      niveau: 'intermediaire',
      contenu:
        `Le Gabon utilise un système à deux acomptes (différent des 4 acomptes trimestriels congolais) :\n1er acompte : ${pct(IS_GA.acompte_1_fraction)} de l'IS N-1 — à verser le ${IS_GA.acompte_1_echeance}\n2e acompte : ${(IS_GA.acompte_2_fraction * 100).toFixed(1)}% de l'IS N-1 — à verser le ${IS_GA.acompte_2_echeance}

Le solde IS (déclaration annuelle + paiement du reliquat ou remboursement d'excédent) est dû le ${IS_GA.solde_echeance}.

En pratique, les acomptes versés ne couvrent que ${(IS_GA.acompte_1_fraction + IS_GA.acompte_2_fraction) * 100 > 100 ? "potentiellement" : `${((IS_GA.acompte_1_fraction + IS_GA.acompte_2_fraction) * 100).toFixed(1)}%`} de l'IS N-1. Si l"IS de l"année N est supérieur, le solde doit être payé au 30 avril.`,
      exempleChiffre:
        `IS N-1 : 6 000 000 XAF\n1er acompte (${pct(IS_GA.acompte_1_fraction)}) au ${IS_GA.acompte_1_echeance} : 1 500 000 XAF\n2e acompte (1/3) au ${IS_GA.acompte_2_echeance} : 2 000 000 XAF\nSi IS réel N = 8 000 000 XAF → Solde au 30 avril : 4 500 000 XAF`,
      piegesFrequents: [
        `Manquer le 1er acompte (${IS_GA.acompte_1_echeance}) — pénalités immédiates`,
        'Baser les acomptes sur N-2 au lieu de N-1',
        'Confondre le solde IS (30 avril) avec la déclaration TVA (15 du mois)',
      ],
      sourceReglementaire: `DGI Gabon — acomptes IS : ${IS_GA.acompte_1_echeance} et ${IS_GA.acompte_2_echeance}`,
    },

    {
      id: 'ga-tva-base',
      titre: 'TVA Gabon : taux et obligations',
      pays: 'Gabon',
      niveau: 'debutant',
      contenu:
        `La TVA gabonaise est estimée à ${pct(TVA_GA.taux_normal)} (taux normal, estimé par cohérence CEMAC — à confirmer auprès de la DGI Gabon). Un taux réduit de ${pct(TVA_GA.taux_reduit)} s'applique à une liste limitée de biens et services. Les exportations bénéficient du taux zéro.

La déclaration est mensuelle avec une échéance au ${TVA_GA.echeance_declaration}. La procédure est similaire aux autres pays CEMAC : collectée − déductible = net à verser.

⚠️ Note : le taux normal TVA Gabon n'est pas encore officiellement confirmé dans nos sources. Vérifier auprès de la DGI Gabon avant toute déclaration officielle.`,
      piegesFrequents: [
        `Utiliser ${pct(TVA_GA.taux_normal)} sans vérification — taux à confirmer DGI Gabon`,
        'Confondre le taux réduit (5%) et le taux normal',
        'Déclarer tardivement (après le 15 du mois)',
      ],
      sourceReglementaire: '⚠️ Central Africa Tax Guide (nov 2023) — TVA taux normal non confirmé officiellement',
    },

    {
      id: 'ga-patente',
      titre: 'Patente Gabon : 0,35% du CA N-2',
      pays: 'Gabon',
      niveau: 'debutant',
      contenu:
        `La Patente gabonaise est calculée au taux de ${pct(PATENTE_GA.taux, 2)} sur le chiffre d"affaires hors taxes de l'avant-dernière année (N-2). Cette base N-2 est une particularité : elle utilise le CA d"il y a deux ans, pas le CA de l'exercice précédent.

L'échéance de paiement est le ${PATENTE_GA.echeance}. Pour les nouvelles entreprises (moins de 2 ans d'activité), une base forfaitaire peut être appliquée — à vérifier auprès de la DGI Gabon.

La Patente est une obligation annuelle non négociable pour exercer légalement une activité commerciale au Gabon.`,
      exempleChiffre:
        `CA N-2 (il y a 2 ans) : 80 000 000 XAF\nPatente : ${pct(PATENTE_GA.taux, 2)} × 80 000 000 = ${Math.round(80_000_000 * PATENTE_GA.taux).toLocaleString('fr-FR')} XAF — à payer avant le ${PATENTE_GA.echeance}`,
      piegesFrequents: [
        'Utiliser le CA N-1 au lieu du CA N-2',
        `Manquer le ${PATENTE_GA.echeance}`,
        'Calculer sur CA TTC — base obligatoirement HT',
      ],
      sourceReglementaire: `DGI Gabon — ${PATENTE_GA.base} — échéance ${PATENTE_GA.echeance}`,
    },

    {
      id: 'ga-irvm',
      titre: 'Dividendes au Gabon : IRVM et retenues',
      pays: 'Gabon',
      niveau: 'avance',
      contenu:
        `L'Impôt sur les Revenus des Valeurs Mobilières (IRVM) au Gabon taxe les dividendes distribués aux associés et actionnaires. Le taux standard est de ${pct(IRVM_GA.dividendes)} sur le montant brut distribué.

Un taux réduit de ${pct(IRVM_GA.dividendes_conditions)} peut s'appliquer sous certaines conditions spécifiques (à vérifier auprès de la DGI Gabon — non précisées dans nos sources actuelles). Les rémunérations versées aux administrateurs et membres du conseil d'administration sont taxées à ${pct(IRVM_GA.remunerations_administrateurs)}.

Pour les prestataires étrangers rendant des services au Gabon, une retenue à la source de ${pct(IS_GA.taux_minimum_ca === 0.011 ? 0.20 : 0.20)} s'applique sur les montants versés. Cette retenue peut être couverte par une convention fiscale bilatérale si elle existe.`,
      piegesFrequents: [
        `Appliquer ${pct(IRVM_GA.dividendes_conditions)} sans vérifier les conditions d'éligibilité au taux réduit`,
        "Oublier l'IRVM lors de la distribution de bénéfices",
        'Ne pas distinguer IRVM dividendes (20%) et IRVM administrateurs (22%)',
      ],
      sourceReglementaire: 'DGI Gabon — IRVM — Central Africa Tax Guide (nov 2023)',
    },
  ],

  // ══════════════════ TCHAD (4 modules) ══════════════════════════════════════

  TD: [
    {
      id: 'td-is-base',
      titre: "L'IS au Tchad : 35% du bénéfice",
      pays: 'Tchad',
      niveau: 'debutant',
      contenu:
        `L"IS tchadien est de ${pct(IS_TD.taux_normal)} sur le bénéfice net imposable. C'est le même taux qu"au Gabon. Contrairement au Congo (minimum 1% CA), le Tchad utilise un minimum fiscal fixe annuel : entre ${IS_TD.minimum_fiscal_activite_specifique.toLocaleString('fr-FR')} XAF et ${IS_TD.minimum_fiscal_activite_generale.toLocaleString('fr-FR')} XAF selon le type d'activité.

Ce minimum fiscal est payé mensuellement par douzième (${(IS_TD.minimum_fiscal_mensuel_fraction * 100).toFixed(1)}% par mois), avec une échéance au ${IS_TD.echeance_minimum_mensuel}. C"est une particularité importante : l'IS n"est pas uniquement annuel au Tchad — il y a une obligation mensuelle.

Le solde IS annuel est dû au ${IS_TD.solde_echeance} lors du dépôt de la déclaration annuelle.`,
      exempleChiffre:
        `Minimum fiscal (activité générale) : ${IS_TD.minimum_fiscal_activite_generale.toLocaleString('fr-FR')} XAF/an\nVersement mensuel : ${Math.round(IS_TD.minimum_fiscal_activite_generale * IS_TD.minimum_fiscal_mensuel_fraction).toLocaleString('fr-FR')} XAF/mois\nÀ payer avant le ${IS_TD.echeance_minimum_mensuel}`,
      piegesFrequents: [
        'Oublier le versement mensuel du minimum fiscal (1/12)',
        'Confondre le minimum fiscal fixe tchadien avec le minimum 1% CA congolais',
        'Ne pas verser le solde IS au 30 avril',
      ],
      sourceReglementaire: 'Central Africa Tax Guide (nov 2023) + TradingEconomics — Tchad',
    },

    {
      id: 'td-minimum-fiscal',
      titre: 'Minimum fiscal mensuel au Tchad',
      pays: 'Tchad',
      niveau: 'intermediaire',
      contenu:
        `Le minimum fiscal tchadien est unique dans la zone CEMAC : il est payé par mensualités obligatoires tout au long de l'année. Le montant annuel est de ${IS_TD.minimum_fiscal_activite_generale.toLocaleString('fr-FR')} XAF pour les activités générales (commerciales, industrielles) et de ${IS_TD.minimum_fiscal_activite_specifique.toLocaleString('fr-FR')} XAF pour certaines activités spécifiques.

Chaque mois, l'entreprise doit verser 1/12 de ce minimum, soit environ ${Math.round(IS_TD.minimum_fiscal_activite_generale / 12).toLocaleString('fr-FR')} XAF/mois pour le régime général. Ce versement est dû au plus tard le ${IS_TD.echeance_minimum_mensuel}.

Ces versements mensuels constituent des acomptes sur l'IS annuel final. Lors de la déclaration annuelle (solde au ${IS_TD.solde_echeance}), les montants déjà versés sont déduits de l'IS calculé sur le bénéfice réel.`,
      exempleChiffre:
        `Activité commerciale — minimum annuel : ${IS_TD.minimum_fiscal_activite_generale.toLocaleString('fr-FR')} XAF\nJanvier au décembre : ${Math.round(IS_TD.minimum_fiscal_activite_generale / 12).toLocaleString('fr-FR')} XAF/mois\nIS réel sur bénéfice : ${pct(IS_TD.taux_normal)} × Bénéfice — déduire les acomptes déjà versés`,
      piegesFrequents: [
        'Ne pas payer les mensualités de minimum fiscal (pénalités + intérêts)',
        'Oublier de déduire les mensualités lors du calcul du solde annuel',
        "Confondre les deux montants (1M et 2M XAF) selon le type d'activité",
      ],
      sourceReglementaire: `Central Africa Tax Guide (nov 2023) — Tchad — ${IS_TD.echeance_minimum_mensuel}`,
    },

    {
      id: 'td-tva-base',
      titre: 'TVA Tchad : déclaration mensuelle',
      pays: 'Tchad',
      niveau: 'debutant',
      contenu:
        `La TVA tchadienne est estimée à ${pct(TVA_TD.taux_normal)} (taux à confirmer auprès de la DGI Tchad — estimé par cohérence CEMAC). Les exportations et le transport international bénéficient du taux zéro.

La déclaration est mensuelle avec une échéance au ${TVA_TD.echeance_declaration}. La mécanique TVA est identique à celle des autres pays CEMAC : collectée sur les ventes, déductible sur les achats, nette à verser chaque mois.

⚠️ Le taux exact n'a pas pu être confirmé dans nos sources actuelles. Avant toute déclaration officielle, vérifier impérativement auprès de la Direction Générale des Impôts du Tchad.`,
      piegesFrequents: [
        `Utiliser ${pct(TVA_TD.taux_normal)} sans confirmation DGI Tchad`,
        'Déclarer tardivement (après le 15 du mois)',
        'Confondre taux zéro (exportations) et exonération',
      ],
      sourceReglementaire: '⚠️ Estimation CEMAC — à confirmer DGI Tchad',
    },

    {
      id: 'td-deductibilite',
      titre: 'Règles de déductibilité fiscale au Tchad',
      pays: 'Tchad',
      niveau: 'avance',
      contenu:
        `Le Tchad impose des limites strictes à la déductibilité de certaines charges :

**Frais de restauration, hôtels et réceptions** : déductibles uniquement dans la limite de ${pct(DEDUCT_TD.frais_restauration_hotels_limite_pct_ca)} du CA net d'impôts. Au-delà, le surplus est réintégré dans le bénéfice imposable.

**Dons et libéralités** : déductibles dans la limite de ${pct(DEDUCT_TD.dons_liberalites_limite_pct_ca)} du CA net d'impôts, mais uniquement avec l'accord préalable du Ministre des Finances. Sans cet accord, les dons sont entièrement réintégrés.

**Frais de siège social hors Tchad/CEMAC** : déductibles dans la limite de ${pct(DEDUCT_TD.frais_siege_hors_tchad_cemac_limite)} des charges totales. Exception : assistance technique pour montage d'usine — déductible en totalité. **Amortissements** : taux minimum ${pct(DEDUCT_TD.amortissement_taux_minimum)}, maximum ${pct(DEDUCT_TD.amortissement_taux_maximum)}.`,
      piegesFrequents: [
        `Déduire des frais de représentation au-delà des ${pct(DEDUCT_TD.frais_restauration_hotels_limite_pct_ca)} du CA`,
        'Déduire des dons sans accord préalable du Ministre des Finances',
        "Appliquer des taux d'amortissement hors fourchette légale",
      ],
      sourceReglementaire: 'Central Africa Tax Guide (nov 2023) — CGI Tchad — règles déductibilité vérifiées',
    },
  ],

  // ══════════════════ RCA (4 modules) ════════════════════════════════════════

  CF: [
    {
      id: 'cf-is-ca',
      titre: "IS RCA : basé sur le CA, pas le bénéfice !",
      pays: 'République Centrafricaine',
      niveau: 'debutant',
      contenu:
        `La RCA possède un système fiscal IS unique en Afrique centrale : l"Impôt sur les Sociétés n'est PAS calculé sur le bénéfice net mais sur le chiffre d"affaires. Cette distinction est fondamentale et souvent source d'erreur.

Le régime général : ${pct(IS_CF.regime_general_taux, 2)} du CA HT annuel, avec un minimum de ${IS_CF.regime_general_plancher.toLocaleString('fr-FR')} XAF. Même une entreprise déficitaire paie cet impôt minimum, ce qui peut être contraignant pour les start-ups.

Le régime agricole bénéficie d'un taux réduit : ${pct(IS_CF.regime_agricole_taux, 1)} du CA HT, avec un minimum de ${IS_CF.regime_agricole_plancher.toLocaleString('fr-FR')} XAF. Un acompte de ${pct(IS_CF.acompte_retenu_source)} est retenu à la source sur les paiements reçus.`,
      exempleChiffre:
        `CA annuel HT : 500 000 000 XAF\nIS régime général : ${pct(IS_CF.regime_general_taux, 2)} × 500 000 000 = ${Math.round(500_000_000 * IS_CF.regime_general_taux).toLocaleString('fr-FR')} XAF (> minimum ${IS_CF.regime_general_plancher.toLocaleString('fr-FR')} XAF)\nVs Congo : IS Congo sur même bénéfice supposé 30M = 30% × 30M = 9M FCFA\n→ RCA plus avantageux si marges faibles, moins avantageux si marges élevées`,
      piegesFrequents: [
        "Calculer l'IS RCA sur le bénéfice comme dans les autres pays CEMAC",
        'Oublier le minimum de 1 850 000 XAF même en cas de CA faible',
        'Confondre régime général (1,85% CA) et régime agricole (0,3% CA)',
      ],
      sourceReglementaire: 'Central Africa Tax Guide (nov 2023) + Bêafrica-Kamba — IS RCA [verified]',
    },

    {
      id: 'cf-tva-base',
      titre: 'TVA en RCA : 19%, seuil 30 millions',
      pays: 'République Centrafricaine',
      niveau: 'debutant',
      contenu:
        `La TVA centrafricaine est de ${pct(TVA_CF.taux_normal)} — taux supérieur à la moyenne CEMAC. L'assujettissement est obligatoire pour les entreprises dont le CA annuel dépasse ${TVA_CF.seuil_assujettissement.toLocaleString('fr-FR')} XAF.

La déclaration est mensuelle, à déposer avant le ${TVA_CF.echeance_declaration}. Comme partout en CEMAC, la TVA collectée − la TVA déductible = la TVA nette à verser.

En dessous du seuil de ${TVA_CF.seuil_assujettissement.toLocaleString('fr-FR')} XAF, l'entreprise peut fonctionner sans TVA, mais elle ne peut pas non plus récupérer la TVA sur ses achats.`,
      exempleChiffre:
        `Ventes HT : 1 000 000 XAF → TVA collectée : ${Math.round(1_000_000 * TVA_CF.taux_normal).toLocaleString('fr-FR')} XAF → TTC : ${(1_000_000 + Math.round(1_000_000 * TVA_CF.taux_normal)).toLocaleString('fr-FR')} XAF`,
      piegesFrequents: [
        `Utiliser 18% (taux Congo/CEMAC moyen) au lieu de ${pct(TVA_CF.taux_normal)} en RCA`,
        "Ne pas vérifier si le CA dépasse le seuil d'assujettissement de 30M XAF",
        'Déclarer après le 15 du mois',
      ],
      sourceReglementaire: 'Central Africa Tax Guide (nov 2023) — TVA RCA [verified]',
    },

    {
      id: 'cf-cds',
      titre: 'CDS : Contribution pour le Développement Social',
      pays: 'République Centrafricaine',
      niveau: 'intermediaire',
      contenu:
        `La CDS (Contribution pour le Développement Social) est une taxe spécifique à la RCA, sans équivalent direct dans les autres pays CEMAC. Elle est de ${pct(PREL_CF.contribution_developpement_social)} de la masse salariale brute totale, versée mensuellement.

La CDS s'applique à toutes les entreprises ayant des employés en RCA, quelle que soit leur taille. Elle est due au plus tard le 15 du mois suivant, en même temps que la TVA.

Cette contribution est une charge patronale entièrement supportée par l'employeur. Elle doit être provisionnée mensuellement pour éviter des pics de trésorerie.`,
      exempleChiffre:
        `Masse salariale brute mensuelle : 3 000 000 XAF\nCDS : ${pct(PREL_CF.contribution_developpement_social)} × 3 000 000 = ${Math.round(3_000_000 * PREL_CF.contribution_developpement_social).toLocaleString('fr-FR')} XAF/mois`,
      piegesFrequents: [
        'Oublier la CDS dans le budget de charges patronales',
        'Calculer la CDS sur la masse salariale nette au lieu du brut',
        'Retarder le paiement mensuel (pénalités)',
      ],
      sourceReglementaire: 'Central Africa Tax Guide (nov 2023) + Bêafrica-Kamba — CDS RCA [verified]',
    },

    {
      id: 'cf-retenue-source',
      titre: 'Retenue à la source sur services étrangers en RCA',
      pays: 'République Centrafricaine',
      niveau: 'avance',
      contenu:
        `En RCA, lorsqu'une entreprise locale paye un prestataire étranger pour des services rendus sur le territoire centrafricain, elle est tenue de retenir à la source ${pct(IS_CF.acompte_retenu_source === 0.03 ? 0.15 : IS_CF.acompte_retenu_source)} du CA brut du service.

Cette retenue est versée directement à l'administration fiscale centrafricaine (DGI) au nom du prestataire étranger. Elle représente l'IS dû par ce prestataire sur son activité en RCA.

De plus, un acompte IS de ${pct(IS_CF.acompte_retenu_source)} est retenu à la source sur les paiements entre entreprises locales. Ces acomptes viendront en déduction de l'IS annuel final du bénéficiaire.`,
      piegesFrequents: [
        'Ne pas appliquer la retenue de 15% sur les paiements à des prestataires étrangers',
        "Confondre la retenue source prestataires étrangers (15%) et l'acompte IS local (3%)",
        'Oublier de délivrer le certificat de retenue au prestataire étranger',
      ],
      sourceReglementaire: 'Central Africa Tax Guide (nov 2023) — RCA — retenues source [verified]',
    },
  ],

  // ══════════════════ GUINÉE ÉQUATORIALE (4 modules) ═════════════════════════

  GQ: [
    {
      id: 'gq-tva-base',
      titre: `TVA Guinée Équatoriale : ${pct(TVA_GQ.taux_normal)} normal, ${pct(TVA_GQ.taux_reduit)} réduit`,
      pays: 'Guinée Équatoriale',
      niveau: 'debutant',
      contenu:
        `La Guinée Équatoriale possède deux taux TVA principaux : un taux normal de ${pct(TVA_GQ.taux_normal)} et un taux réduit de ${pct(TVA_GQ.taux_reduit)} pour les produits de première nécessité et les livres. Les exportations bénéficient du taux zéro.

Le taux de ${pct(TVA_GQ.taux_normal)} est le plus bas de la zone CEMAC (Congo : 18,9%, Cameroun : 19,25%, Gabon et Tchad : 18%, RCA : 19%). C'est un avantage compétitif pour les entreprises basées en Guinée Équatoriale.

La déclaration est mensuelle avec une échéance au ${TVA_GQ.echeance_declaration}. La langue officielle étant l'espagnol, certains formulaires sont en espagnol — attention aux traductions.`,
      exempleChiffre:
        `Vente HT : 1 000 000 XAF\nTaux normal ${pct(TVA_GQ.taux_normal)} → TVA : ${Math.round(1_000_000 * TVA_GQ.taux_normal).toLocaleString('fr-FR')} XAF → TTC : ${(1_000_000 + Math.round(1_000_000 * TVA_GQ.taux_normal)).toLocaleString('fr-FR')} XAF\nTaux réduit ${pct(TVA_GQ.taux_reduit)} → TVA : ${Math.round(1_000_000 * TVA_GQ.taux_reduit).toLocaleString('fr-FR')} XAF → TTC : ${(1_000_000 + Math.round(1_000_000 * TVA_GQ.taux_reduit)).toLocaleString('fr-FR')} XAF`,
      piegesFrequents: [
        `Utiliser ${pct(TVA_GQ.taux_normal + 0.03)} (taux Congo) au lieu de ${pct(TVA_GQ.taux_normal)} en GQ`,
        'Appliquer le taux normal à des produits éligibles au taux réduit (${pct(TVA_GQ.taux_reduit)})',
        'Déclarer après le 15 du mois',
      ],
      sourceReglementaire: 'Central Africa Tax Guide (nov 2023) + Rivermate (fév 2025) — TVA GQ [verified]',
    },

    {
      id: 'gq-irpp',
      titre: "IRPP Guinée Équatoriale : barème progressif (max 25%)",
      pays: 'Guinée Équatoriale',
      niveau: 'intermediaire',
      contenu:
        `L'IRPP en Guinée Équatoriale est progressif avec un taux maximum de ${pct(TRANCHES_IRPP_GQ[TRANCHES_IRPP_GQ.length - 1].taux)} pour les revenus annuels dépassant ${TRANCHES_IRPP_GQ[TRANCHES_IRPP_GQ.length - 2].max.toLocaleString('fr-FR')} XAF. Ce taux maximum est vérifié (source officielle). Les tranches intermédiaires sont estimées par cohérence avec les pays CEMAC voisins.

Barème (attention — tranches intermédiaires estimées) : ${TRANCHES_IRPP_GQ.map(t => `${pct(t.taux)} jusqu'à ${t.max === Infinity ? '+∞' : t.max.toLocaleString('fr-FR')} XAF`).join(' | ')}.

L'IRPP est versé par l'employeur dans les ${15} premiers jours du mois suivant la paie. Attention : les tranches en dessous de 20M XAF sont estimées et doivent être vérifiées auprès de la DGI GQ avant usage officiel.`,
      exempleChiffre:
        `Revenu annuel : 25 000 000 XAF\nTranche > 20M XAF [verified] : ${pct(TRANCHES_IRPP_GQ[4].taux)} × (25M − 20M) = ${Math.round(5_000_000 * TRANCHES_IRPP_GQ[4].taux).toLocaleString('fr-FR')} XAF\n⚠️ Tranches inférieures à vérifier DGI GQ`,
      piegesFrequents: [
        'Utiliser les tranches estimées pour des déclarations officielles sans vérification DGI GQ',
        `Appliquer ${pct(TRANCHES_IRPP_GQ[4].taux)} à tout le revenu au lieu du barème marginal`,
        'Oublier que le versement est dû dans les 15 premiers jours du mois suivant',
      ],
      sourceReglementaire: `Central Africa Tax Guide (nov 2023) + Rivermate — ⚠️ Seul le taux ${pct(TRANCHES_IRPP_GQ[4].taux)} (>20M) est vérifié`,
    },

    {
      id: 'gq-is',
      titre: "IS Guinée Équatoriale : 25% + MIT",
      pays: 'Guinée Équatoriale',
      niveau: 'intermediaire',
      contenu:
        `L'IS en Guinée Équatoriale est estimé à ${pct(IS_GQ.taux_normal)} du bénéfice net imposable (⚠️ taux à confirmer auprès de la DGI GQ). En cas de bénéfice nul, le MIT (Impôt Minimum des Sociétés) s'applique.

Le MIT est versé en ${IS_GQ.mit_paiements_annuels} paiements annuels obligatoires. Les petits contribuables peuvent opter pour un régime simplifié. Le montant exact du MIT n'est pas précisé dans nos sources — se référer à la DGI GQ.

Les amortissements sont autorisés entre ${pct(IS_GQ.amortissement_taux_minimum)} et ${pct(IS_GQ.amortissement_taux_maximum)} (amortissement accéléré jusqu'à 100% autorisé, ce qui est très favorable pour les investissements en équipements).`,
      piegesFrequents: [
        `Utiliser ${pct(IS_GQ.taux_normal)} sans confirmation DGI GQ — taux estimé`,
        "Oublier le MIT même en l'absence de bénéfice",
        "Ne pas profiter de l'amortissement accéléré (100%) pour les gros investissements",
      ],
      sourceReglementaire: '⚠️ Données partiellement estimées — Central Africa Tax Guide (nov 2023) + Rivermate',
    },

    {
      id: 'gq-retenues',
      titre: 'Retenues à la source en Guinée Équatoriale',
      pays: 'Guinée Équatoriale',
      niveau: 'avance',
      contenu:
        `La Guinée Équatoriale a des taux de retenue à la source parmi les plus élevés de la zone CEMAC. Pour les individus non-résidents, la retenue est de ${pct(IS_GQ.taux_normal === 0.25 ? 0.20 : 0.20)} sur le revenu brut. Pour les dividendes distribués à des entreprises étrangères : ${pct(0.25)}.

Dans le secteur pétrolier et minier (secteur dominant en GQ), les retenues pour contractants et sous-traitants non-résidents sont de seulement ${pct(0.10)}, ce qui reflète des accords spécifiques avec ce secteur.

Les paiements pour mobilisation/démobilisation et transport sont taxés à ${pct(0.05)}. Ces taux distincts nécessitent une analyse préalable pour tout nouveau contrat avec des partenaires étrangers.`,
      piegesFrequents: [
        'Appliquer un taux uniforme — chaque catégorie a son propre taux en GQ',
        'Oublier les retenues sur dividendes (25%) lors de la distribution aux associés étrangers',
        'Ne pas distinguer le secteur pétrolier (10%) du régime général (20%)',
      ],
      sourceReglementaire: 'Central Africa Tax Guide (nov 2023) + Rivermate — retenues GQ [verified]',
    },
  ],

  // ══════════════════ RDC (5 modules) ════════════════════════════════════════

  CD: [
    {
      id: 'cd-reforme2026',
      titre: 'La réforme fiscale RDC 2026 : ce qui change',
      pays: 'RD Congo',
      niveau: 'debutant',
      contenu:
        `La RDC a adopté une réforme fiscale majeure avec les Lois n°23/052 et n°23/053 (novembre 2023) et la Loi de Finances n°25/060 du 29 décembre 2025, entrée en vigueur le 1er janvier 2026. Cette réforme change la terminologie officielle.

Deux changements terminologiques critiques :
— L'IS (Impôt sur les Sociétés) devient l'**IBP** (Impôt sur les Bénéfices et Profits)
— L'IRPP (Impôt sur le Revenu des Personnes Physiques) devient l'**IPR** (Impôt Professionnel sur les Rémunérations)

Ces changements ne sont pas que cosmétiques : les taux, barèmes et règles ont aussi été révisés. Toute documentation antérieure à 2026 référençant "IS" ou "IRPP" pour la RDC doit être mise à jour.`,
      piegesFrequents: [
        "Continuer à parler d'IS et d'IRPP en RDC — terminologie officielle obsolète depuis 2026",
        "Appliquer l'ancien barème IRPP (tranches en dizaines de millions) — INTERDIT",
        'Ne pas informer ses associés étrangers de ce changement terminologique',
      ],
      sourceReglementaire: 'LF N°25/060 du 29/12/2025 — Ministère des Finances RDC [verified]',
    },

    {
      id: 'cd-ibp',
      titre: 'IBP (IS) RDC : 30% + impôt minimum',
      pays: 'RD Congo',
      niveau: 'intermediaire',
      contenu:
        `L"IBP (ex-IS) en RDC est de ${pct(IS_CD.taux_normal)} sur le bénéfice net imposable. En cas de bénéfice nul ou insuffisant, un impôt minimum de ${pct(IS_CD.taxe_minimale_ca)} du CA s'applique, avec des planchers selon la taille de l"entreprise :

— Grandes Entreprises (GE) : minimum ${cdf(IS_CD.impot_minimum_ge_fc)}\n— Moyennes Entreprises (ME) : minimum ${cdf(IS_CD.impot_minimum_me_fc)}\n— Petites Entreprises (PE) : minimum ${cdf(IS_CD.impot_minimum_pe_fc)}

Les PE peuvent également opter pour le régime simplifié : ${pct(IS_CD.pe_taux_ventes)} sur les ventes ou ${pct(IS_CD.pe_taux_prestations)} sur les prestations de services (plus simple que le bénéfice réel). Les micro-entreprises ont un forfait fixe de ${cdf(IS_CD.micro_forfait_fc)}.`,
      exempleChiffre:
        `Entreprise ME — CA : 2 000 000 000 FC, Bénéfice : 0 (déficit)\nIBP minimum : ${pct(IS_CD.taxe_minimale_ca)} × 2 000 000 000 = 20 000 000 FC\nPlancher ME : ${cdf(IS_CD.impot_minimum_me_fc)}\n→ IBP à payer : 20 000 000 FC (supérieur au plancher 750 000 FC)`,
      piegesFrequents: [
        'Appliquer le plancher GE (2,5M FC) à une ME ou PE',
        "Oublier que même en déficit, l'IBP minimum est dû",
        'Ne pas considérer le régime simplifié PE pour réduire la charge fiscale',
      ],
      sourceReglementaire: 'LF N°25/060 du 29/12/2025 — IBP RDC [verified]',
    },

    {
      id: 'cd-ipr-bareme',
      titre: 'IPR RDC : barème 10 tranches (524K à 22,9M FC)',
      pays: 'RD Congo',
      niveau: 'intermediaire',
      contenu:
        `L'IPR (ex-IRPP) est calculé sur la rémunération annuelle brute selon un barème marginal progressif à ${IPR_RDC.tranches.length} tranches. ⚠️ Toutes les tranches sont exprimées en Francs Congolais (FC) annuels.

Barème officiel LF N°25/060 : ${IPR_RDC.tranches.map((t, i) => `Tranche ${i + 1} — ${pct(t.taux)} : ${t.min.toLocaleString('fr-FR')} → ${t.max === Infinity ? '∞' : t.max.toLocaleString('fr-FR')} FC`).join('\n')}.

⚠️ INTERDICTION ABSOLUE : N'utiliser jamais un barème IPR avec des tranches en dizaines de millions (60M / 120M / 300M / 600M FC) — ce barème est INCORRECT pour la RDC. La 1ère tranche imposable du barème officiel plafonne à ${IPR_RDC.tranches[1].max.toLocaleString('fr-FR')} FC, pas à 60 000 000 FC.`,
      exempleChiffre:
        `Rémunération annuelle : 5 000 000 FC\nTranche 0% : 0 → 524 160 FC = 0 FC\nTranche 15% : 524 161 → 1 428 000 FC = ${Math.round((1_428_000 - 524_160) * 0.15).toLocaleString('fr-FR')} FC\nTranche 20% : 1 428 001 → 2 700 000 FC = ${Math.round((2_700_000 - 1_428_000) * 0.20).toLocaleString('fr-FR')} FC\nTranche 22,5% : 2 700 001 → 4 620 000 FC = ${Math.round((4_620_000 - 2_700_000) * 0.225).toLocaleString('fr-FR')} FC\nTranche 25% : 4 620 001 → 5 000 000 FC = ${Math.round((5_000_000 - 4_620_000) * 0.25).toLocaleString('fr-FR')} FC\nIPR total annuel : ${Math.round((1_428_000 - 524_160) * 0.15 + (2_700_000 - 1_428_000) * 0.20 + (4_620_000 - 2_700_000) * 0.225 + (5_000_000 - 4_620_000) * 0.25).toLocaleString('fr-FR')} FC`,
      piegesFrequents: [
        "Utiliser l'ancien barème IRPP pré-2026 (tranches en dizaines de millions FC)",
        'Appliquer un taux marginal unique au lieu du barème progressif',
        "Calculer sur une base mensuelle au lieu d'annuelle (barème = annuel en FC)",
      ],
      sourceReglementaire: 'LF N°25/060 du 29/12/2025 — IPR barème officiel [verified]',
    },

    {
      id: 'cd-tva-autoliquidation',
      titre: 'TVA 16% et autoliquidation B2B transfrontalière',
      pays: 'RD Congo',
      niveau: 'avance',
      contenu:
        `La TVA en RDC est de ${pct(TVA_CD.taux_normal)} sur les ventes et prestations locales. Le seuil d'assujettissement est de ${TVA_CD.seuil_assujettissement_cdf.toLocaleString('fr-FR')} CDF de CA annuel, mais les professions libérales sont assujetties sans seuil de CA.

Nouveauté réforme 2026 : l"autoliquidation TVA B2B transfrontalière. Lorsqu"une entreprise congolaise paye un fournisseur étranger qui n"a pas de représentant fiscal en RDC, elle doit auto-liquider la TVA de ${pct(TVA_CD.autoliquidation_b2b_taux)} : c'est-à-dire déclarer et payer la TVA sur l"achat comme si elle était le vendeur.

Cette règle s"applique à tous les services importés (consulting étranger, licences logicielles, cloud services, etc.). L"autoliquidation est à la fois déductible et collectée — l"effet net est nul si l'entreprise est assujettie, mais l"obligation déclarative reste.`,
      exempleChiffre:
        `Service SaaS facturé par un fournisseur US sans représentant RDC : 100 000 CDF HT\nTVA autoliquidée : ${pct(TVA_CD.taux_normal)} × 100 000 = ${Math.round(100_000 * TVA_CD.taux_normal).toLocaleString('fr-FR')} CDF\n→ À déclarer comme TVA collectée ET déductible (effet net = 0 si assujetti)`,
      piegesFrequents: [
        'Ne pas autoliquider la TVA sur les paiements à des fournisseurs étrangers',
        `Utiliser 18% (Congo CG) au lieu de ${pct(TVA_CD.taux_normal)} en RDC`,
        'Oublier les professions libérales assujetties sans seuil de CA',
      ],
      sourceReglementaire: 'LF N°25/060 — TVA RDC ${pct(TVA_CD.taux_normal)} [verified] — seuil ${TVA_CD.seuil_assujettissement_cdf.toLocaleString("fr-FR")} CDF',
    },

    {
      id: 'cd-facture-electronique',
      titre: 'Facture normalisée e-UF/e-MCF : obligations 2026',
      pays: 'RD Congo',
      niveau: 'intermediaire',
      contenu:
        `Depuis le 1er décembre 2025, la RDC impose la facturation normalisée via les systèmes e-UF (e-machine caisse fiscale) et e-MCF. Toute facture émise par une entreprise assujettie doit passer par ce système et comporter un code fiscal unique délivré par la DGI.

Ce système est directement connecté à la DGI : chaque facture est enregistrée en temps réel. L"objectif est de lutter contre la fraude fiscale et d"élargir l"assiette TVA. Les entreprises doivent s'équiper d"un terminal e-MCF agréé ou utiliser une solution logicielle compatible.

Les sanctions pour non-conformité sont sévères : nullité des factures, redressement fiscal sur les ventes non tracées. Oraforme est compatible avec le standard e-UF/e-MCF pour les émissions de factures RDC.`,
      piegesFrequents: [
        'Continuer à émettre des factures manuelles non conformes après décembre 2025',
        'Ne pas activer le module e-MCF dans son logiciel de facturation',
        "Croire que les PME sont exemptées — l'obligation s'applique à tous les assujettis TVA",
      ],
      sourceReglementaire: 'LF N°25/060 — facture normalisée obligatoire depuis 1er décembre 2025 [verified]',
    },
  ],
}

// ── Fonction d'accès ──────────────────────────────────────────────────────────

export function getAcademyModules(countryCode: string, niveau?: string): AcademyModule[] {
  const normalizedCode = countryCode === 'CD_USD' ? 'CD' : countryCode
  const modules = FISCAL_ACADEMY[normalizedCode] ?? []
  if (!niveau) return modules
  return modules.filter(m => m.niveau === niveau)
}
