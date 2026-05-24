'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { calculerTVACongo } from '@/lib/fiscalite-congo'
import Link from 'next/link'
import {
  ChefHat, Plus, ShoppingCart, Trash2, CheckCircle, X,
  QrCode, Globe, ExternalLink, Copy, Check, Loader2,
  Table2, RefreshCw, Monitor, TrendingUp, BarChart2,
  Clock, DollarSign, Users, AlertTriangle, BookOpen, Truck, Package, Ban,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

type StatutCmd   = 'en_attente' | 'en_preparation' | 'pret' | 'livre' | 'annule'
type ModeCmd     = 'sur_place'  | 'emporter'       | 'livraison'
type ModePaie    = 'especes'    | 'airtel'          | 'mtn'

interface MenuItem   { id: string; nom: string; categorie: string; prix: number; emoji: string; disponible: boolean }
interface CmdItem    { nom: string; quantite: number; prix: number }
interface Commande   {
  id: string; table_num: string | null; mode: ModeCmd; items: CmdItem[]
  statut: StatutCmd; total: number; source: string; paiement: string
  numero_recu: string | null; client_nom: string | null; created_at: string
}
interface RestoTable { id: string; numero: number; nom: string | null; capacite: number; statut: string }
interface Recette    { id: string; menu_item_id: string; article_id: string | null; article_nom: string; quantite_par_portion: number; unite: string }
interface StockArticle { id: string; nom: string; quantite: number; unite: string; seuil_alerte: number | null }
interface AchatLigne { article_id?: string; article_nom: string; quantite: number; prix_unitaire: number }
interface Achat      { id: string; fournisseur_nom: string; date_achat: string; total: number; mode_paiement: string; lignes: AchatLigne[]; note: string | null; created_at: string }

const TABS = [
  { key: 'caisse',    label: '🧾 Caisse' },
  { key: 'commandes', label: '📋 Commandes' },
  { key: 'menu',      label: '🍽️ Menu' },
  { key: 'tables',    label: '📍 Tables & QR' },
  { key: 'recettes',  label: '📖 Recettes' },
  { key: 'achats',    label: '🛒 Achats' },
  { key: 'rapport',   label: '📊 Rapport du jour' },
] as const
type TabKey = typeof TABS[number]['key']

const MODES_PAIE: { key: ModePaie; label: string; color: string }[] = [
  { key: 'especes', label: 'Espèces',    color: '#142850' },
  { key: 'airtel',  label: 'Airtel Money', color: '#E53935' },
  { key: 'mtn',     label: 'MTN MoMo',   color: '#F51E33' },
]

const TABLE_COLORS: Record<string, string> = {
  libre:   '#484F58',
  occupee: '#F51E33',
  prete:   '#142850',
}

function fmtFCFA(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA' }
function qrUrl(data: string) { return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}` }

export default function RestaurantPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [tab, setTab]               = useState<TabKey>('caisse')
  const [menu, setMenu]             = useState<MenuItem[]>([])
  const [commandes, setCommandes]   = useState<Commande[]>([])
  const [tables, setTables]         = useState<RestoTable[]>([])
  const [loading, setLoading]       = useState(true)
  const [toast, setToast]           = useState('')

  // Caisse
  const [panier, setPanier]         = useState<CmdItem[]>([])
  const [tableNum, setTableNum]     = useState('')
  const [mode, setMode]             = useState<ModeCmd>('sur_place')
  const [modePaie, setModePaie]     = useState<ModePaie>('especes')
  const [catFilter, setCatFilter]   = useState('')
  const [savingCmd, setSavingCmd]   = useState(false)
  const [receipt, setReceipt]       = useState<{ commandeId: string; numeroRecu: string; fiscal: ReturnType<typeof calculerTVACongo> } | null>(null)

  // Menu form
  const [showMenuForm, setShowMenuForm] = useState(false)
  const [savingMenu, setSavingMenu]     = useState(false)
  const [menuForm, setMenuForm]         = useState({ nom: '', categorie: '', prix: '', emoji: '🍽️' })

  // Tables form
  const [addingTable, setAddingTable] = useState(false)
  const [tableForm, setTableForm]     = useState({ numero: '', nom: '', capacite: '4' })
  const [copied, setCopied]           = useState(false)

  // Recettes
  const [recettes,         setRecettes]         = useState<Recette[]>([])
  const [stockArticles,    setStockArticles]     = useState<StockArticle[]>([])
  const [selectedMenuItem, setSelectedMenuItem] = useState('')
  const [recetteForm,      setRecetteForm]       = useState({ article_id: '', article_nom: '', quantite: '', unite: 'unité' })
  const [savingRecette,    setSavingRecette]     = useState(false)

  // Achats
  const [achats,         setAchats]         = useState<Achat[]>([])
  const [showAchatForm,  setShowAchatForm]  = useState(false)
  const [savingAchat,    setSavingAchat]    = useState(false)
  const [achatForm,      setAchatForm]      = useState({
    fournisseur_nom: '', date_achat: new Date().toISOString().split('T')[0],
    mode_paiement: 'especes', note: '',
    lignes: [{ article_id: '', article_nom: '', quantite: 0, prix_unitaire: 0 }] as AchatLigne[],
  })

  const fetchAll = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [m, c, t, r, s, a] = await Promise.all([
      supabase.from('resto_menu').select('*').eq('tenant_id', tenantId).order('categorie'),
      supabase.from('resto_commandes').select('*').eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('resto_tables').select('*').eq('tenant_id', tenantId).order('numero'),
      supabase.from('resto_recettes').select('*').eq('tenant_id', tenantId),
      supabase.from('stock_articles').select('id,nom,quantite,unite,seuil_alerte').eq('tenant_id', tenantId).order('nom'),
      supabase.from('resto_achats').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(30),
    ])
    setMenu((m.data ?? []) as MenuItem[])
    setCommandes((c.data ?? []) as Commande[])
    setTables((t.data ?? []) as RestoTable[])
    setRecettes((r.data ?? []) as Recette[])
    setStockArticles((s.data ?? []) as StockArticle[])
    setAchats((a.data ?? []) as Achat[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { fetchAll() }, [fetchAll])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── CAISSE ──────────────────────────────────────────────────────────────────

  function ajouterAuPanier(item: MenuItem) {
    if (!item.disponible) return
    setPanier(p => {
      const ex = p.find(x => x.nom === item.nom)
      if (ex) return p.map(x => x.nom === item.nom ? { ...x, quantite: x.quantite + 1 } : x)
      return [...p, { nom: item.nom, quantite: 1, prix: item.prix }]
    })
  }

  function changerQte(nom: string, delta: number) {
    setPanier(p => {
      const ex = p.find(x => x.nom === nom)
      if (!ex) return p
      if (ex.quantite + delta <= 0) return p.filter(x => x.nom !== nom)
      return p.map(x => x.nom === nom ? { ...x, quantite: x.quantite + delta } : x)
    })
  }

  const sousTotal = panier.reduce((s, x) => s + x.quantite * x.prix, 0)

  async function passerCommande() {
    if (panier.length === 0) return
    setSavingCmd(true)
    try {
      const res = await fetch('/api/resto/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: panier, table_num: tableNum, mode, mode_paiement: modePaie }),
      })
      const data = await res.json()
      if (!res.ok) { showToast('Erreur : ' + data.error); return }
      setReceipt({ commandeId: data.commandeId, numeroRecu: data.numeroRecu, fiscal: data.fiscal })
      // Marquer la table comme occupée
      if (tableNum) {
        const tableId = tables.find(t => String(t.numero) === tableNum)?.id
        if (tableId) {
          await supabase.from('resto_tables').update({ statut: 'occupee' }).eq('id', tableId)
          setTables(ts => ts.map(t => t.id === tableId ? { ...t, statut: 'occupee' } : t))
        }
      }
      setPanier([]); setTableNum('')
      fetchAll()
    } finally {
      setSavingCmd(false)
    }
  }

  // ── RECETTES ─────────────────────────────────────────────────────────────────

  const recettesDuPlat = recettes.filter(r => r.menu_item_id === selectedMenuItem)

  async function addRecette() {
    if (!selectedMenuItem || !recetteForm.article_nom.trim() || !recetteForm.quantite) return
    setSavingRecette(true)
    await supabase.from('resto_recettes').insert({
      tenant_id:            tenantId,
      menu_item_id:         selectedMenuItem,
      article_id:           recetteForm.article_id || null,
      article_nom:          recetteForm.article_nom.trim(),
      quantite_par_portion: Number(recetteForm.quantite),
      unite:                recetteForm.unite || 'unité',
    })
    setRecetteForm({ article_id: '', article_nom: '', quantite: '', unite: 'unité' })
    setSavingRecette(false)
    fetchAll()
  }

  async function deleteRecette(id: string) {
    await supabase.from('resto_recettes').delete().eq('id', id)
    setRecettes(r => r.filter(x => x.id !== id))
  }

  // ── ACHATS ───────────────────────────────────────────────────────────────────

  function addAchatLigne() {
    setAchatForm(p => ({ ...p, lignes: [...p.lignes, { article_id: '', article_nom: '', quantite: 0, prix_unitaire: 0 }] }))
  }

  function removeAchatLigne(i: number) {
    setAchatForm(p => ({ ...p, lignes: p.lignes.filter((_, j) => j !== i) }))
  }

  function updateAchatLigne(i: number, field: string, value: string) {
    setAchatForm(p => ({
      ...p,
      lignes: p.lignes.map((l, j) => j === i
        ? { ...l, [field]: (field === 'quantite' || field === 'prix_unitaire') ? Number(value) : value }
        : l
      ),
    }))
  }

  async function saveAchat() {
    if (!achatForm.fournisseur_nom.trim() || !achatForm.lignes.length) return
    setSavingAchat(true)
    try {
      const res = await fetch('/api/resto/achats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(achatForm),
      })
      const data = await res.json()
      if (!res.ok) { showToast('Erreur : ' + data.error); return }
      showToast('Achat enregistré !')
      setShowAchatForm(false)
      setAchatForm({ fournisseur_nom: '', date_achat: new Date().toISOString().split('T')[0], mode_paiement: 'especes', note: '', lignes: [{ article_id: '', article_nom: '', quantite: 0, prix_unitaire: 0 }] })
      fetchAll()
    } finally {
      setSavingAchat(false)
    }
  }

  async function deleteAchat(id: string) {
    await supabase.from('resto_achats').delete().eq('id', id)
    setAchats(a => a.filter(x => x.id !== id))
  }

  // ── ANNULATION COMMANDE ───────────────────────────────────────────────────────

  async function annulerCommande(id: string) {
    await supabase.from('resto_commandes').update({ statut: 'annule' }).eq('id', id)
    setCommandes(c => c.map(x => x.id === id ? { ...x, statut: 'annule' as StatutCmd } : x))
    showToast('Commande annulée')
  }

  // ── MENU ────────────────────────────────────────────────────────────────────

  async function saveMenuItem() {
    if (!menuForm.nom.trim()) return
    setSavingMenu(true)
    await supabase.from('resto_menu').insert({
      tenant_id: tenantId, nom: menuForm.nom, categorie: menuForm.categorie,
      prix: Number(menuForm.prix), emoji: menuForm.emoji, disponible: true,
    })
    setShowMenuForm(false)
    setMenuForm({ nom: '', categorie: '', prix: '', emoji: '🍽️' })
    setSavingMenu(false)
    fetchAll()
  }

  async function toggleDispo(id: string, current: boolean) {
    await supabase.from('resto_menu').update({ disponible: !current }).eq('id', id)
    setMenu(m => m.map(x => x.id === id ? { ...x, disponible: !current } : x))
  }

  async function deleteMenuItem(id: string) {
    await supabase.from('resto_menu').delete().eq('id', id)
    setMenu(m => m.filter(x => x.id !== id))
  }

  // ── COMMANDES ────────────────────────────────────────────────────────────────

  async function updateStatut(id: string, statut: StatutCmd) {
    await supabase.from('resto_commandes').update({ statut }).eq('id', id)
    setCommandes(c => c.map(x => x.id === id ? { ...x, statut } : x))
  }

  // ── TABLES ──────────────────────────────────────────────────────────────────

  async function addTable() {
    if (!tableForm.numero || !tenantId) return
    setAddingTable(true)
    await supabase.from('resto_tables').insert({
      tenant_id: tenantId, numero: Number(tableForm.numero),
      nom: tableForm.nom || null, capacite: Number(tableForm.capacite),
    })
    setTableForm({ numero: '', nom: '', capacite: '4' })
    setAddingTable(false)
    fetchAll()
  }

  async function deleteTable(id: string) {
    await supabase.from('resto_tables').delete().eq('id', id)
    setTables(t => t.filter(x => x.id !== id))
  }

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/resto/${tenantId}` : ''
  const categories = [...new Set(menu.map(m => m.categorie).filter(Boolean))]
  const filteredMenu = catFilter ? menu.filter(m => m.categorie === catFilter) : menu

  // ── KPIs du jour ────────────────────────────────────────────────────────────

  const today = new Date().toISOString().split('T')[0]
  const cmdsDuJour = commandes.filter(c => c.created_at.startsWith(today))
  const caDuJour   = cmdsDuJour.filter(c => c.statut !== 'annule').reduce((s, c) => s + c.total, 0)
  const enPrepa    = commandes.filter(c => ['en_attente', 'en_preparation'].includes(c.statut)).length

  // ── Données rapport ──────────────────────────────────────────────────────────

  const cmdsLivrees = cmdsDuJour.filter(c => c.statut !== 'annule')
  const chartPaie = [
    { name: 'Espèces',    val: cmdsLivrees.filter(c => ['especes', 'Espèces'].includes(c.paiement ?? '')).reduce((s, c) => s + c.total, 0), color: '#142850' },
    { name: 'Airtel',     val: cmdsLivrees.filter(c => c.paiement === 'airtel').reduce((s, c) => s + c.total, 0), color: '#E53935' },
    { name: 'MTN',        val: cmdsLivrees.filter(c => c.paiement === 'mtn').reduce((s, c) => s + c.total, 0), color: '#F51E33' },
  ].filter(x => x.val > 0)

  const platCount: Record<string, number> = {}
  cmdsLivrees.forEach(c => (c.items as CmdItem[]).forEach(it => { platCount[it.nom] = (platCount[it.nom] ?? 0) + it.quantite }))
  const topPlats = Object.entries(platCount).sort(([,a],[,b]) => b-a).slice(0,5).map(([nom,q]) => ({ nom, q }))

  // CA par heure
  const chartHeure = Array.from({ length: 14 }, (_, i) => {
    const h = 8 + i
    const total = cmdsLivrees
      .filter(c => new Date(c.created_at).getHours() === h)
      .reduce((s, c) => s + c.total, 0)
    return { heure: `${h}h`, total }
  })

  async function cloturerCaisse() {
    if (!tenantId) return
    const fiscal = calculerTVACongo(caDuJour)
    const esp = cmdsLivrees.filter(c => ['especes','Espèces'].includes(c.paiement??'')).reduce((s,c)=>s+c.total,0)
    const airt= cmdsLivrees.filter(c=>c.paiement==='airtel').reduce((s,c)=>s+c.total,0)
    const mtn = cmdsLivrees.filter(c=>c.paiement==='mtn').reduce((s,c)=>s+c.total,0)
    await supabase.from('rapport_caisse').upsert({
      tenant_id: tenantId, date: today,
      ca_brut: caDuJour, ca_net: fiscal.ht,
      nb_commandes: cmdsLivrees.length,
      total_especes: esp, total_airtel: airt, total_mtn: mtn,
      benefice_net: caDuJour,
      cloture_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,date' })
    showToast('Caisse clôturée avec succès !')
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#F51E33] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text)] shadow-xl animate-pulse">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Restaurant & POS</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            CA du jour : <span className="text-[#F51E33] font-semibold">{fmtFCFA(caDuJour)}</span>
            {' · '}{cmdsDuJour.length} commande{cmdsDuJour.length > 1 ? 's' : ''}
            {enPrepa > 0 && <span className="text-[#F51E33]"> · {enPrepa} en attente</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] text-xs transition-colors">
            <RefreshCw size={13} />
          </button>
          <Link href="/dashboard/restaurant/cuisine"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#F51E33]/40 text-[#F51E33] text-xs font-semibold hover:bg-[#F51E33]/10 transition-colors">
            <Monitor size={13} /> Écran Cuisine
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-5 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.key ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CAISSE POS ───────────────────────────────────────────────────────── */}
      {tab === 'caisse' && (
        <div>
          {/* KPIs du jour */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "CA aujourd'hui",   val: fmtFCFA(caDuJour),           color: '#F51E33', icon: DollarSign },
              { label: 'Commandes',        val: cmdsDuJour.length,            color: '#F51E33', icon: ShoppingCart },
              { label: 'En attente/prép',  val: enPrepa,                      color: enPrepa > 0 ? '#F51E33' : '#142850', icon: Clock },
              { label: 'Plats au menu',    val: menu.filter(m=>m.disponible).length, color: '#142850', icon: ChefHat },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={13} style={{ color: k.color }} />
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{k.label}</p>
                  </div>
                  <p className="text-lg font-bold" style={{ color: k.color }}>{k.val}</p>
                </div>
              )
            })}
          </div>

          {/* Filtres catégories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button onClick={() => setCatFilter('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!catFilter ? 'bg-[#F51E33]/15 text-[#F51E33] border border-[#F51E33]/30' : 'text-[var(--text-secondary)] hover:text-[var(--text)] border border-[var(--border)]'}`}>
                Tous
              </button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setCatFilter(cat === catFilter ? '' : cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFilter === cat ? 'bg-[#F51E33]/15 text-[#F51E33] border border-[#F51E33]/30' : 'text-[var(--text-secondary)] hover:text-[var(--text)] border border-[var(--border)]'}`}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grille des plats */}
            <div className="lg:col-span-2">
              {filteredMenu.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-secondary)]">
                  <ChefHat size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucun plat — ajoutez-en dans l&apos;onglet Menu</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredMenu.map(item => (
                    <button key={item.id} onClick={() => ajouterAuPanier(item)} disabled={!item.disponible}
                      className={`text-left p-4 rounded-xl border transition-all relative ${
                        item.disponible
                          ? 'border-[var(--border)] bg-[var(--card-bg)] hover:border-[#F51E33]/40 active:scale-95'
                          : 'border-[var(--border)] bg-[var(--card-bg)]/50 opacity-40 cursor-not-allowed'
                      }`}>
                      <div className="text-2xl mb-2">{item.emoji}</div>
                      <p className="text-sm font-medium text-[var(--text)] leading-tight">{item.nom}</p>
                      <p className="text-xs font-bold text-[#F51E33] mt-1">{fmtFCFA(item.prix)}</p>
                      {!item.disponible && (
                        <span className="absolute top-2 right-2 text-[9px] bg-[#F51E33]/15 text-[#F51E33] px-1 py-0.5 rounded font-bold">INDISPO</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Panier */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 flex flex-col h-fit sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart size={16} className="text-[#F51E33]" />
                <h3 className="font-semibold text-[var(--text)] text-sm">Commande en cours</h3>
                {panier.length > 0 && (
                  <button onClick={() => setPanier([])} className="ml-auto text-[var(--text-secondary)] hover:text-[#F51E33] transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Table + mode */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select value={tableNum} onChange={e => setTableNum(e.target.value)}
                  className="px-2 py-2 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text)] text-xs focus:outline-none focus:border-[#F51E33]">
                  <option value="">À emporter</option>
                  {tables.map(t => <option key={t.id} value={String(t.numero)}>Table {t.numero}{t.nom ? ` — ${t.nom}` : ''}</option>)}
                </select>
                <select value={mode} onChange={e => setMode(e.target.value as ModeCmd)}
                  className="px-2 py-2 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text)] text-xs focus:outline-none focus:border-[#F51E33]">
                  <option value="sur_place">Sur place</option>
                  <option value="emporter">À emporter</option>
                  <option value="livraison">Livraison</option>
                </select>
              </div>

              {/* Articles */}
              {panier.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] text-center py-6">Sélectionnez des plats</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {panier.map(item => (
                    <div key={item.nom} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text)] truncate">{item.nom}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{fmtFCFA(item.prix)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => changerQte(item.nom, -1)} className="w-5 h-5 rounded bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text)] text-xs font-bold flex items-center justify-center">−</button>
                        <span className="text-xs font-bold text-[var(--text)] w-5 text-center">{item.quantite}</span>
                        <button onClick={() => changerQte(item.nom, +1)} className="w-5 h-5 rounded bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text)] text-xs font-bold flex items-center justify-center">+</button>
                      </div>
                      <span className="text-xs font-semibold text-[#F51E33] shrink-0 w-20 text-right">{fmtFCFA(item.prix * item.quantite)}</span>
                    </div>
                  ))}
                </div>
              )}

              {panier.length > 0 && (() => {
                const { tva, ca, ttc } = calculerTVACongo(sousTotal)
                return (
                  <>
                    <div className="border-t border-[var(--border)] pt-3 mb-3 space-y-1">
                      <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                        <span>Sous-total HT</span><span>{fmtFCFA(sousTotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                        <span>TVA (18%)</span><span>{fmtFCFA(tva)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                        <span>CA (5% TVA)</span><span>{fmtFCFA(ca)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-[var(--text)] border-t border-[var(--border)] pt-1.5">
                        <span>Total TTC</span><span className="text-[#F51E33]">{fmtFCFA(ttc)}</span>
                      </div>
                    </div>

                    {/* Mode de paiement */}
                    <div className="flex gap-1.5 mb-3">
                      {MODES_PAIE.map(mp => (
                        <button key={mp.key} onClick={() => setModePaie(mp.key)}
                          style={{ borderColor: modePaie === mp.key ? mp.color : undefined, color: modePaie === mp.key ? mp.color : undefined }}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                            modePaie === mp.key ? 'bg-opacity-10' : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                          }`}>
                          {mp.label}
                        </button>
                      ))}
                    </div>

                    <button onClick={passerCommande} disabled={savingCmd}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-bold hover:bg-[#F51E33]/90 disabled:opacity-50 transition-colors">
                      {savingCmd ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      Valider & Imprimer reçu
                    </button>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── COMMANDES KANBAN ─────────────────────────────────────────────────── */}
      {tab === 'commandes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[var(--text-secondary)]">{commandes.length} commande(s) récentes</p>
            <div className="flex gap-2">
              <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] text-xs transition-colors">
                <RefreshCw size={12} /> Actualiser
              </button>
              <Link href="/dashboard/restaurant/cuisine"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F51E33]/10 border border-[#F51E33]/30 text-[#F51E33] text-xs font-semibold">
                <Monitor size={12} /> Écran Cuisine
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: ['en_attente', 'en_preparation'] as StatutCmd[], label: 'En préparation', color: '#F51E33', nextStatut: 'pret' as StatutCmd, btnLabel: 'Marquer prêt' },
              { key: ['pret'] as StatutCmd[], label: 'Prêt à servir', color: '#F51E33', nextStatut: 'livre' as StatutCmd, btnLabel: 'Marquer livré' },
              { key: ['livre'] as StatutCmd[], label: 'Livré', color: '#142850', nextStatut: null, btnLabel: '' },
            ].map(col => {
              const cols = commandes.filter(c => (col.key as string[]).includes(c.statut))
              return (
                <div key={col.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-semibold text-[var(--text)]">{col.label}</span>
                    <span className="ml-auto text-xs text-[var(--text-secondary)]">{cols.length}</span>
                  </div>
                  <div className="p-3 space-y-2 min-h-[200px]">
                    {cols.length === 0 && (
                      <p className="text-xs text-[var(--text-secondary)] text-center pt-8">Aucune commande</p>
                    )}
                    {cols.map(cmd => (
                      <div key={cmd.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-[var(--text)]">
                            {cmd.numero_recu ?? cmd.id.slice(0,8)}
                          </span>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {cmd.table_num ? `Table ${cmd.table_num}` : 'Emporter'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(cmd.items as CmdItem[]).map((it, i) => (
                            <span key={i} className="text-[10px] bg-[var(--surface-alt)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">
                              {it.quantite}× {it.nom}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-[#F51E33]">{fmtFCFA(cmd.total)}</span>
                          <div className="flex items-center gap-1">
                            {cmd.statut === 'en_attente' && (
                              <button onClick={() => annulerCommande(cmd.id)}
                                title="Annuler"
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                                <Ban size={10} />
                              </button>
                            )}
                            {col.nextStatut && (
                              <button onClick={() => updateStatut(cmd.id, col.nextStatut!)}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors"
                                style={{ background: `${col.color}20`, color: col.color }}>
                                {col.btnLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MENU ─────────────────────────────────────────────────────────────── */}
      {tab === 'menu' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowMenuForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[#F51E33]/90 transition-colors">
              <Plus size={15} /> Ajouter un plat
            </button>
          </div>
          {menu.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              <ChefHat size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Menu vide — ajoutez des plats</p>
            </div>
          ) : (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Plat', 'Catégorie', 'Prix', 'Statut', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {menu.map((item, i) => (
                    <tr key={item.id} className={`border-b border-[var(--border)] hover:bg-white/5/50 ${i === menu.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3"><span className="mr-2">{item.emoji}</span><span className="font-medium text-[var(--text)]">{item.nom}</span></td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{item.categorie || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-[#F51E33]">{fmtFCFA(item.prix)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleDispo(item.id, item.disponible)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-all ${item.disponible ? 'bg-[#1a3570]/10 text-[#1a3570] hover:bg-red-500/10 hover:text-red-400' : 'bg-red-500/10 text-red-400 hover:bg-[#1a3570]/10 hover:text-[#1a3570]'}`}>
                          {item.disponible ? '● Disponible' : '● Indisponible'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteMenuItem(item.id)} className="text-[var(--text-secondary)] hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showMenuForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowMenuForm(false)} />
              <div className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <button onClick={() => setShowMenuForm(false)} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"><X size={16} /></button>
                <h3 className="text-base font-bold text-[var(--text)] mb-4">Ajouter un plat</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">Emoji</label>
                      <input value={menuForm.emoji} onChange={e => setMenuForm(p => ({ ...p, emoji: e.target.value }))}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none text-center" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">Nom du plat *</label>
                      <input value={menuForm.nom} onChange={e => setMenuForm(p => ({ ...p, nom: e.target.value }))} placeholder="Poulet Yassa"
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">Catégorie</label>
                    <input value={menuForm.categorie} onChange={e => setMenuForm(p => ({ ...p, categorie: e.target.value }))} placeholder="Plats, Entrées, Desserts…"
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">Prix (FCFA)</label>
                    <input type="number" value={menuForm.prix} onChange={e => setMenuForm(p => ({ ...p, prix: e.target.value }))} placeholder="3500"
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50" />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowMenuForm(false)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                    Annuler
                  </button>
                  <button onClick={saveMenuItem} disabled={savingMenu || !menuForm.nom}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:bg-[#F51E33]/90 disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingMenu && <Loader2 size={13} className="animate-spin" />}
                    Ajouter
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TABLES & QR ──────────────────────────────────────────────────────── */}
      {tab === 'tables' && (
        <div className="space-y-5">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
              <Table2 size={15} className="text-[#F51E33]" /> Ajouter une table
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">N° Table *</label>
                <input type="number" placeholder="1" value={tableForm.numero} onChange={e => setTableForm(p=>({...p,numero:e.target.value}))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Nom</label>
                <input placeholder="VIP, Terrasse…" value={tableForm.nom} onChange={e => setTableForm(p=>({...p,nom:e.target.value}))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Capacité</label>
                <input type="number" placeholder="4" value={tableForm.capacite} onChange={e => setTableForm(p=>({...p,capacite:e.target.value}))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
              </div>
            </div>
            <button onClick={addTable} disabled={addingTable || !tableForm.numero}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[#F51E33]/90 disabled:opacity-50 transition-colors">
              {addingTable ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer la table
            </button>
          </div>

          {tables.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-secondary)]">
              <Table2 size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Aucune table configurée</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {tables.map(t => {
                const tableUrl = `${publicUrl}?table=${t.numero}`
                const color = TABLE_COLORS[t.statut] ?? '#484F58'
                return (
                  <div key={t.id} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 text-center hover:border-[#F51E33]/30 transition-colors">
                    <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: color }} />
                    <p className="text-base font-bold text-[#101729] mb-0.5">
                      Table {t.numero}{t.nom ? ` — ${t.nom}` : ''}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] capitalize mb-4">{t.statut} · {t.capacite} places</p>
                    <div className="bg-white p-2 rounded-xl mx-auto w-fit mb-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrUrl(tableUrl)} alt={`QR Table ${t.numero}`} width={100} height={100} className="rounded" />
                    </div>
                    <div className="space-y-2">
                      <button onClick={() => { navigator.clipboard.writeText(tableUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] text-xs transition-colors">
                        {copied ? <><Check size={12} className="text-[#F51E33]" /> Copié !</> : <><Copy size={12} /> Copier lien</>}
                      </button>
                      <a href={tableUrl} target="_blank" rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[#F51E33]/30 text-[#F51E33] hover:bg-[#F51E33]/10 text-xs transition-colors">
                        <ExternalLink size={12} /> Page client
                      </a>
                      <button onClick={() => deleteTable(t.id)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[var(--text-secondary)] hover:text-red-400 text-xs transition-colors">
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── RECETTES ─────────────────────────────────────────────────────────── */}
      {tab === 'recettes' && (
        <div className="space-y-5">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-1 flex items-center gap-2">
              <BookOpen size={15} className="text-[#F51E33]" /> Recettes — ingrédients par plat
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Liez les ingrédients (stock) à chaque plat. Le stock se décrémente automatiquement à chaque vente.
            </p>

            <div className="mb-5">
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">Sélectionner un plat</label>
              <select value={selectedMenuItem} onChange={e => setSelectedMenuItem(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#F51E33]/50">
                <option value="">— Choisir un plat du menu —</option>
                {menu.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.nom}</option>)}
              </select>
            </div>

            {selectedMenuItem && (
              <div>
                {/* Ingrédients actuels */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Ingrédients actuels</p>
                  {recettesDuPlat.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)] py-3 text-center border border-dashed border-[var(--border)] rounded-lg">
                      Aucun ingrédient — ajoutez-en ci-dessous
                    </p>
                  ) : (
                    <div className="bg-[var(--surface)] rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            {['Ingrédient', 'Qté / portion', 'Unité', ''].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-[10px] text-[var(--text-secondary)] uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recettesDuPlat.map(r => (
                            <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                              <td className="px-3 py-2.5 font-medium text-[var(--text)]">{r.article_nom}</td>
                              <td className="px-3 py-2.5 text-[var(--text-secondary)]">{r.quantite_par_portion}</td>
                              <td className="px-3 py-2.5 text-[var(--text-secondary)]">{r.unite}</td>
                              <td className="px-3 py-2.5">
                                <button onClick={() => deleteRecette(r.id)} className="text-[var(--text-secondary)] hover:text-red-400">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Ajouter un ingrédient */}
                <div className="border border-dashed border-[var(--border)] rounded-xl p-4">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Ajouter un ingrédient</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Depuis le stock</label>
                      <select value={recetteForm.article_id} onChange={e => {
                        const art = stockArticles.find(a => a.id === e.target.value)
                        setRecetteForm(p => ({ ...p, article_id: e.target.value, article_nom: art?.nom || p.article_nom }))
                      }} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text)] outline-none">
                        <option value="">— Sélectionner un article —</option>
                        {stockArticles.map(a => <option key={a.id} value={a.id}>{a.nom} ({a.quantite} {a.unite})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Ou saisir manuellement</label>
                      <input value={recetteForm.article_nom} onChange={e => setRecetteForm(p => ({ ...p, article_nom: e.target.value, article_id: '' }))}
                        placeholder="Nom ingrédient" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text)] placeholder-[#484F58] outline-none" />
                    </div>
                    <div className="flex gap-1">
                      <div className="flex-1">
                        <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Qté</label>
                        <input type="number" step="0.01" min="0" value={recetteForm.quantite}
                          onChange={e => setRecetteForm(p => ({ ...p, quantite: e.target.value }))}
                          placeholder="0.5" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text)] outline-none text-right" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Unité</label>
                        <input value={recetteForm.unite} onChange={e => setRecetteForm(p => ({ ...p, unite: e.target.value }))}
                          placeholder="kg, L, u" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text)] outline-none" />
                      </div>
                    </div>
                  </div>
                  <button onClick={addRecette} disabled={savingRecette || !recetteForm.article_nom.trim() || !recetteForm.quantite}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-semibold disabled:opacity-50 transition-colors">
                    {savingRecette ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Ajouter l&apos;ingrédient
                  </button>
                </div>
              </div>
            )}

            {!selectedMenuItem && menu.length > 0 && (
              <div className="text-center py-10 text-[var(--text-secondary)]">
                <Package size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Sélectionnez un plat pour gérer sa recette</p>
              </div>
            )}
            {menu.length === 0 && (
              <div className="text-center py-10 text-[var(--text-secondary)]">
                <ChefHat size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Ajoutez d&apos;abord des plats dans l&apos;onglet Menu</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACHATS ───────────────────────────────────────────────────────────── */}
      {tab === 'achats' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-secondary)]">{achats.length} achat(s) récent(s)</p>
            <button onClick={() => setShowAchatForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[#F51E33]/90 transition-colors">
              <Plus size={15} /> Nouvel achat
            </button>
          </div>

          {/* Formulaire nouvel achat */}
          {showAchatForm && (
            <div className="bg-[var(--card-bg)] border border-[#F51E33]/30 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#F51E33] mb-4 flex items-center gap-2">
                <Truck size={14} /> Enregistrer un achat fournisseur
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Fournisseur *</label>
                  <input value={achatForm.fournisseur_nom} onChange={e => setAchatForm(p => ({ ...p, fournisseur_nom: e.target.value }))}
                    placeholder="Nom du fournisseur" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Date</label>
                  <input type="date" value={achatForm.date_achat} onChange={e => setAchatForm(p => ({ ...p, date_achat: e.target.value }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Mode de paiement</label>
                  <select value={achatForm.mode_paiement} onChange={e => setAchatForm(p => ({ ...p, mode_paiement: e.target.value }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                    <option value="especes">Espèces</option>
                    <option value="airtel">Airtel Money</option>
                    <option value="mtn">MTN MoMo</option>
                    <option value="virement">Virement</option>
                    <option value="credit">Crédit</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Note</label>
                  <input value={achatForm.note} onChange={e => setAchatForm(p => ({ ...p, note: e.target.value }))}
                    placeholder="Optionnel" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#484F58] outline-none" />
                </div>
              </div>

              {/* Lignes articles */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Articles</p>
                  <button onClick={addAchatLigne} className="text-xs text-[#F51E33] hover:underline flex items-center gap-1">
                    <Plus size={11} /> Ajouter une ligne
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-12 gap-2 mb-1">
                    {['Article *', '', 'Qté', 'Prix unitaire', 'Total', ''].map((h, i) => (
                      <div key={i} className={`text-[10px] text-[var(--text-secondary)] uppercase ${i === 0 ? 'col-span-4' : i === 1 ? 'col-span-2' : i === 2 ? 'col-span-2' : i === 3 ? 'col-span-2' : i === 4 ? 'col-span-1' : 'col-span-1'}`}>{h}</div>
                    ))}
                  </div>
                  {achatForm.lignes.map((ligne, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <input value={ligne.article_nom} onChange={e => updateAchatLigne(i, 'article_nom', e.target.value)}
                          placeholder="Ingrédient / article" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text)] placeholder-[#484F58] outline-none" />
                      </div>
                      <div className="col-span-2">
                        <select value={ligne.article_id ?? ''} onChange={e => {
                          const art = stockArticles.find(a => a.id === e.target.value)
                          if (art) updateAchatLigne(i, 'article_nom', art.nom)
                          updateAchatLigne(i, 'article_id', e.target.value)
                        }} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[10px] text-[var(--text)] outline-none">
                          <option value="">Stock…</option>
                          {stockArticles.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="0.1" value={ligne.quantite || ''}
                          onChange={e => updateAchatLigne(i, 'quantite', e.target.value)}
                          placeholder="Qté" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text)] outline-none text-right" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" value={ligne.prix_unitaire || ''}
                          onChange={e => updateAchatLigne(i, 'prix_unitaire', e.target.value)}
                          placeholder="Prix" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text)] outline-none text-right" />
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-xs font-semibold text-[#F51E33]">
                          {ligne.quantite && ligne.prix_unitaire ? fmtFCFA(ligne.quantite * ligne.prix_unitaire) : '—'}
                        </span>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeAchatLigne(i)} className="text-[var(--text-secondary)] hover:text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {achatForm.lignes.length > 0 && (
                  <div className="flex justify-end mt-3 pt-2 border-t border-[var(--border)]">
                    <span className="text-sm font-bold text-[#F51E33]">
                      Total : {fmtFCFA(achatForm.lignes.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0))}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowAchatForm(false)} className="px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                  Annuler
                </button>
                <button onClick={saveAchat} disabled={savingAchat || !achatForm.fournisseur_nom.trim() || !achatForm.lignes.length}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:bg-[#F51E33]/90 disabled:opacity-50 transition-colors">
                  {savingAchat && <Loader2 size={13} className="animate-spin" />}
                  Enregistrer l&apos;achat
                </button>
              </div>
            </div>
          )}

          {/* Liste des achats */}
          {achats.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              <Truck size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Aucun achat enregistré</p>
              <p className="text-xs mt-1">Enregistrez vos achats fournisseurs pour mettre à jour le stock</p>
            </div>
          ) : (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Date', 'Fournisseur', 'Mode', 'Articles', 'Total', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {achats.map((a, i) => (
                    <tr key={a.id} className={`border-b border-[var(--border)] hover:bg-white/5/50 ${i === achats.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{new Date(a.date_achat).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 font-medium text-[var(--text)]">{a.fournisseur_nom}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] capitalize">{a.mode_paiement}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{(a.lignes as AchatLigne[]).length} article(s)</td>
                      <td className="px-4 py-3 font-semibold text-[#F51E33]">{fmtFCFA(a.total)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteAchat(a.id)} className="text-[var(--text-secondary)] hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── RAPPORT DU JOUR ──────────────────────────────────────────────────── */}
      {tab === 'rapport' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'CA TTC', val: fmtFCFA(caDuJour), color: '#F51E33' },
              { label: 'CA HT', val: fmtFCFA(calculerTVACongo(caDuJour).ht), color: '#F51E33' },
              { label: 'TVA collectée', val: fmtFCFA(calculerTVACongo(caDuJour).tva), color: '#8B0070' },
              { label: 'Nb commandes', val: cmdsDuJour.length, color: '#142850' },
            ].map(k => (
              <div key={k.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">{k.label}</p>
                <p className="text-lg font-bold" style={{ color: k.color }}>{k.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* CA par heure */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-4">CA par heure</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartHeure}>
                  <XAxis dataKey="heure" tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip contentStyle={{ background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    formatter={(v: any) => [fmtFCFA(Number(v ?? 0)), 'CA']} />
                  <Bar dataKey="total" fill="#F51E33" radius={[2, 2, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Répartition paiements */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Répartition paiements</h3>
              {chartPaie.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-[var(--text-secondary)] text-sm">Aucun paiement aujourd&apos;hui</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={chartPaie} dataKey="val" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={e => `${e.name}`}>
                      {chartPaie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(v: any) => [fmtFCFA(Number(v ?? 0))]}
                      contentStyle={{ background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#8B949E' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top 5 plats */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Top 5 plats du jour</h3>
            {topPlats.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Aucune vente aujourd&apos;hui</p>
            ) : (
              <div className="space-y-2">
                {topPlats.map((p, i) => (
                  <div key={p.nom} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[var(--text-secondary)] w-5">#{i+1}</span>
                    <div className="flex-1 bg-[var(--surface-alt)] rounded-full h-2">
                      <div className="h-2 rounded-full bg-[#F51E33]" style={{ width: `${(p.q / topPlats[0].q) * 100}%` }} />
                    </div>
                    <span className="text-sm text-[var(--text)] min-w-[120px]">{p.nom}</span>
                    <span className="text-xs font-bold text-[#F51E33] w-12 text-right">{p.q}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertes stock */}
          {stockArticles.some(a => a.quantite <= 0 || (a.seuil_alerte !== null && a.quantite <= a.seuil_alerte)) && (
            <div className="bg-[var(--card-bg)] border border-[#F51E33]/40 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#F51E33] mb-3 flex items-center gap-2">
                <AlertTriangle size={15} /> Alertes stock
              </h3>
              <div className="space-y-2">
                {stockArticles
                  .filter(a => a.quantite <= 0 || (a.seuil_alerte !== null && a.quantite <= a.seuil_alerte))
                  .slice(0, 8)
                  .map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text)] font-medium">{a.nom}</span>
                      <span className={`font-bold ${a.quantite <= 0 ? 'text-[#F51E33]' : 'text-[#F51E33]'}`}>
                        {a.quantite <= 0 ? 'RUPTURE' : `${a.quantite} ${a.unite} (seuil : ${a.seuil_alerte})`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Clôture caisse */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-2 flex items-center gap-2">
              <AlertTriangle size={15} className="text-[#F51E33]" /> Clôture de caisse
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              La clôture enregistre le rapport journalier dans Supabase et lie les données à la trésorerie.
            </p>
            <button onClick={cloturerCaisse}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F51E33]/10 border border-[#F51E33]/30 text-[#F51E33] text-sm font-semibold hover:bg-[#F51E33]/20 transition-colors">
              <BarChart2 size={15} /> Clôturer la caisse du jour
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL REÇU ───────────────────────────────────────────────────────── */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setReceipt(null)} />
          <div className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <button onClick={() => setReceipt(null)} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"><X size={16} /></button>
            <div className="text-center mb-5">
              <CheckCircle size={40} className="text-[#F51E33] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[var(--text)]">Commande enregistrée !</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Reçu N° <span className="text-[#F51E33] font-bold">{receipt.numeroRecu}</span></p>
            </div>
            <div className="bg-[var(--surface)] rounded-xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Sous-total HT</span>
                <span className="text-[var(--text)]">{fmtFCFA(receipt.fiscal.ht)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-secondary)]">TVA (18%)</span>
                <span className="text-[var(--text)]">{fmtFCFA(receipt.fiscal.tva)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-secondary)]">CA (5% TVA)</span>
                <span className="text-[var(--text)]">{fmtFCFA(receipt.fiscal.ca)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-[var(--border)] pt-2">
                <span className="text-[var(--text)]">Total TTC</span>
                <span className="text-[#F51E33]">{fmtFCFA(receipt.fiscal.ttc)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setReceipt(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                Fermer
              </button>
              <a href={`/api/resto/receipt/${receipt.commandeId}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:bg-[#F51E33]/90 transition-colors flex items-center justify-center gap-2">
                <TrendingUp size={13} /> Télécharger PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
