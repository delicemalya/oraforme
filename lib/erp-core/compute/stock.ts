/**
 * lib/erp-core/compute/stock.ts
 *
 * Calcul de la valeur et des alertes de stock.
 * UNIQUE implémentation — précédemment isolée dans analytics/summary uniquement.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArticleRow {
  id?:           string
  nom?:          string
  quantite:      number | null
  quantite_min?: number | null
  prix_unitaire: number | null
}

export interface StockSummary {
  valeur_totale:      number
  nb_articles:        number
  nb_rupture:         number   // quantite <= 0
  nb_critiques:       number   // 0 < quantite < quantite_min
  pct_sante:          number   // % articles OK / total
  top5_valeur:        StockArticleTop[]
}

export interface StockArticleTop {
  nom:     string
  valeur:  number
  quantite: number
}

// ── Sélecteur Supabase ────────────────────────────────────────────────────────

export const ARTICLE_SELECT = 'id, nom, quantite, quantite_min, prix_unitaire' as const

// ── Fonction principale ───────────────────────────────────────────────────────

export function computeStockSummary(articles: ArticleRow[]): StockSummary {
  const valid = articles.filter(a => a.quantite !== null)

  const valeur_totale = valid.reduce((s, a) => s + ((a.quantite ?? 0) * (a.prix_unitaire ?? 0)), 0)
  const nb_rupture    = valid.filter(a => (a.quantite ?? 0) <= 0).length
  const nb_critiques  = valid.filter(a => {
    const q = a.quantite ?? 0
    return q > 0 && q < (a.quantite_min ?? 5)
  }).length
  const nb_ok = valid.length - nb_rupture - nb_critiques
  const pct_sante = valid.length > 0 ? Math.round((nb_ok / valid.length) * 100) : 100

  const top5_valeur = [...valid]
    .sort((a, b) => ((b.quantite ?? 0) * (b.prix_unitaire ?? 0)) - ((a.quantite ?? 0) * (a.prix_unitaire ?? 0)))
    .slice(0, 5)
    .map(a => ({
      nom:      a.nom ?? '—',
      valeur:   (a.quantite ?? 0) * (a.prix_unitaire ?? 0),
      quantite: a.quantite ?? 0,
    }))

  return {
    valeur_totale, nb_articles: valid.length,
    nb_rupture, nb_critiques, pct_sante, top5_valeur,
  }
}
