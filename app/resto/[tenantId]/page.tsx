'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Plus, Minus, Trash2, ChefHat,
  MapPin, Phone, MessageSquare, X, Check, Loader2,
} from 'lucide-react'

interface MenuItem { id: string; nom: string; categorie: string; prix: number; emoji: string }
interface CartItem  { nom: string; quantite: number; prix: number; emoji: string }

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export default function PublicOrderPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const searchParams  = useSearchParams()
  const tableFromQR   = searchParams.get('table') ?? ''

  const [menu,       setMenu]       = useState<MenuItem[]>([])
  const [restaurant, setRestaurant] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [cart,       setCart]       = useState<CartItem[]>([])
  const [showCart,   setShowCart]   = useState(false)
  const [mode,       setMode]       = useState<'sur_place' | 'emporter' | 'livraison'>('sur_place')
  const [tableNum,   setTableNum]   = useState(tableFromQR)
  const [clientNom,  setClientNom]  = useState('')
  const [clientTel,  setClientTel]  = useState('')
  const [adresse,    setAdresse]    = useState('')
  const [note,       setNote]       = useState('')
  const [paiement,   setPaiement]   = useState('especes')
  const [submitting, setSubmitting]  = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [error,      setError]      = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/resto/${tenantId}/menu`)
    if (!res.ok) { setLoading(false); return }
    const { items, restaurant: r } = await res.json()
    setMenu(items)
    setRestaurant(r)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const categories = [...new Set(menu.map(m => m.categorie).filter(Boolean))]
  const total      = cart.reduce((s, i) => s + i.prix * i.quantite, 0)
  const cartCount  = cart.reduce((s, i) => s + i.quantite, 0)

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.nom === item.nom)
      if (ex) return prev.map(c => c.nom === item.nom ? { ...c, quantite: c.quantite + 1 } : c)
      return [...prev, { nom: item.nom, prix: item.prix, quantite: 1, emoji: item.emoji }]
    })
  }

  function updateQty(nom: string, delta: number) {
    setCart(prev => prev.flatMap(c => {
      if (c.nom !== nom) return [c]
      const q = c.quantite + delta
      return q <= 0 ? [] : [{ ...c, quantite: q }]
    }))
  }

  async function submit() {
    if (cart.length === 0) return
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/resto/${tenantId}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map(({ nom, prix, quantite }) => ({ nom, prix, quantite })),
        table_num: tableNum,
        mode,
        total,
        client_nom: clientNom,
        client_tel: clientTel,
        adresse_livraison: adresse,
        note_client: note,
        paiement,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Erreur'); setSubmitting(false); return }
    setSuccess(true)
    setCart([])
    setShowCart(false)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#F51E33]" size={32} />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-full bg-[#2EA043]/20 flex items-center justify-center mb-6"
        >
          <Check size={36} className="text-[#2EA043]" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-2">Commande envoyée !</h1>
        <p className="text-[var(--text-secondary)] mb-6">Votre commande a été transmise en cuisine. Merci !</p>
        <button
          onClick={() => setSuccess(false)}
          className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ background: '#F51E33' }}
        >
          Nouvelle commande
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={20} className="text-[#F51E33]" />
          <div>
            <p className="text-sm font-bold text-white">{restaurant}</p>
            {tableFromQR && <p className="text-xs text-[var(--text-secondary)]">Table {tableFromQR}</p>}
          </div>
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="relative flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all"
          style={{
            borderColor: cartCount > 0 ? '#F51E33' : 'rgba(255,255,255,0.1)',
            color:       cartCount > 0 ? '#F51E33' : '#8B949E',
            background:  cartCount > 0 ? '#F51E3312' : 'transparent',
          }}
        >
          <ShoppingCart size={16} />
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center">
              {cartCount}
            </span>
          )}
          {total > 0 && <span>{fmt(total)}</span>}
        </button>
      </div>

      {/* Menu */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {menu.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-secondary)]">
            <ChefHat size={40} className="mx-auto mb-3 opacity-30" />
            <p>Menu non disponible pour le moment.</p>
          </div>
        ) : (
          (categories.length ? categories : ['Menu']).map(cat => (
            <div key={cat} className="mb-8">
              <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4 pb-2 border-b border-white/[0.06]">
                {cat}
              </h2>
              <div className="space-y-3">
                {menu.filter(m => (m.categorie || 'Menu') === cat).map(item => {
                  const inCart = cart.find(c => c.nom === item.nom)
                  return (
                    <motion.div
                      key={item.id}
                      className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                      <span className="text-3xl shrink-0">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{item.nom}</p>
                        <p className="text-sm font-bold text-[#F51E33] mt-0.5">{fmt(item.prix)}</p>
                      </div>
                      <div className="shrink-0">
                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQty(item.nom, -1)}
                              className="w-8 h-8 rounded-full bg-white/[0.08] text-white flex items-center justify-center hover:bg-white/[0.12] transition-colors"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="text-sm font-bold text-white w-5 text-center">{inCart.quantite}</span>
                            <button
                              onClick={() => addToCart(item)}
                              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                              style={{ background: '#F51E33', color: '#142850' }}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                            style={{ background: '#F51E33', color: '#142850' }}
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card-bg)] border-t border-white/[0.08] rounded-t-2xl max-h-[90vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="max-w-2xl mx-auto p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">Ma commande</h2>
                  <button onClick={() => setShowCart(false)} className="text-[var(--text-secondary)] hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                {/* Cart items */}
                <div className="space-y-3 mb-5">
                  {cart.map(item => (
                    <div key={item.nom} className="flex items-center gap-3">
                      <span className="text-xl shrink-0">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.nom}</p>
                        <p className="text-xs text-[#F51E33]">{fmt(item.prix)} × {item.quantite}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => updateQty(item.nom, -1)} className="w-7 h-7 rounded-full bg-white/[0.08] text-white flex items-center justify-center">
                          <Minus size={12} />
                        </button>
                        <span className="text-sm font-bold text-white w-4 text-center">{item.quantite}</span>
                        <button onClick={() => updateQty(item.nom, 1)} className="w-7 h-7 rounded-full bg-white/[0.08] text-white flex items-center justify-center">
                          <Plus size={12} />
                        </button>
                        <button onClick={() => setCart(c => c.filter(x => x.nom !== item.nom))} className="text-[var(--text-secondary)] hover:text-red-400 ml-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mode selector */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(['sur_place', 'emporter', 'livraison'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all"
                      style={{
                        borderColor: mode === m ? '#F51E33' : 'rgba(255,255,255,0.08)',
                        color:       mode === m ? '#F51E33' : '#8B949E',
                        background:  mode === m ? '#F51E3315' : 'transparent',
                      }}
                    >
                      {m === 'sur_place' ? 'Sur place' : m === 'emporter' ? 'À emporter' : 'Livraison'}
                    </button>
                  ))}
                </div>

                {/* Info fields */}
                <div className="space-y-3 mb-4">
                  {mode === 'sur_place' && (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-xs">Table</span>
                      <input
                        className="w-full pl-14 pr-3 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-[#F51E33]/50"
                        placeholder="Numéro de table"
                        value={tableNum}
                        onChange={e => setTableNum(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                      <input
                        className="w-full pl-8 pr-3 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-[#F51E33]/50"
                        placeholder="Votre téléphone"
                        value={clientTel}
                        onChange={e => setClientTel(e.target.value)}
                      />
                    </div>
                    <input
                      className="flex-1 px-3 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-[#F51E33]/50"
                      placeholder="Votre nom"
                      value={clientNom}
                      onChange={e => setClientNom(e.target.value)}
                    />
                  </div>
                  {mode === 'livraison' && (
                    <div className="relative">
                      <MapPin size={13} className="absolute left-3 top-3 text-[var(--text-secondary)]" />
                      <input
                        className="w-full pl-8 pr-3 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-[#F51E33]/50"
                        placeholder="Adresse de livraison"
                        value={adresse}
                        onChange={e => setAdresse(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="relative">
                    <MessageSquare size={13} className="absolute left-3 top-3 text-[var(--text-secondary)]" />
                    <textarea
                      className="w-full pl-8 pr-3 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-[#F51E33]/50 resize-none"
                      rows={2}
                      placeholder="Note pour la cuisine (facultatif)"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                  </div>

                  {/* Paiement */}
                  <div className="grid grid-cols-3 gap-2">
                    {[['especes', '💵 Espèces'], ['mobile_money', '📱 Mobile Money'], ['carte', '💳 Carte']].map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setPaiement(v)}
                        className="py-2 rounded-lg text-xs font-medium border transition-all"
                        style={{
                          borderColor: paiement === v ? '#2EA043' : 'rgba(255,255,255,0.08)',
                          color:       paiement === v ? '#2EA043' : '#8B949E',
                          background:  paiement === v ? '#2EA04315' : 'transparent',
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

                {/* Total + submit */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-lg font-bold text-[#F51E33]">{fmt(total)}</span>
                </div>

                <motion.button
                  onClick={submit}
                  disabled={submitting || cart.length === 0}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: '#F51E33', color: '#142850' }}
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  {submitting ? 'Envoi en cours…' : 'Commander'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
