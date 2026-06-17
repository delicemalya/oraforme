'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { Users, Search, RefreshCw, ChevronRight, Shield, FileText, Phone, Mail } from 'lucide-react'

interface ClientRecord {
  assure_nom: string
  assure_email: string
  assure_telephone: string
  assure_type: string
  polices: Array<{
    id: string
    numero_police: string
    type_police: string
    statut: string
    prime_montant: number
    date_echeance: string
  }>
  total_primes: number
  nb_actives: number
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const TYPE_LABELS: Record<string, string> = {
  vie:'Vie', auto:'Auto', habitation:'Habitation', sante:'Santé',
  responsabilite_civile:'RC', transport:'Transport', agricole:'Agricole',
  maritime:'Maritime', aviation:'Aviation', voyage:'Voyage', incendie:'Incendie',
}

export default function ClientsPage() {
  const { tenant } = useTenantContext()
  const tenantId = tenant?.tenantId ?? ''
  const [clients,  setClients]  = useState<ClientRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/assurance/polices')
      const json = await res.json()
      const polices: Array<{
        assure_nom: string; assure_email: string; assure_telephone: string;
        assure_type: string; id: string; numero_police: string; type_police: string;
        statut: string; prime_montant: number; date_echeance: string;
      }> = json.data ?? []

      // Agréger par assuré
      const map = new Map<string, ClientRecord>()
      polices.forEach(p => {
        const key = p.assure_nom.toLowerCase().trim()
        if (!map.has(key)) {
          map.set(key, {
            assure_nom: p.assure_nom, assure_email: p.assure_email,
            assure_telephone: p.assure_telephone, assure_type: p.assure_type,
            polices: [], total_primes: 0, nb_actives: 0,
          })
        }
        const c = map.get(key)!
        c.polices.push({ id: p.id, numero_police: p.numero_police, type_police: p.type_police, statut: p.statut, prime_montant: p.prime_montant, date_echeance: p.date_echeance })
        c.total_primes += p.prime_montant ?? 0
        if (p.statut === 'active') c.nb_actives++
      })
      setClients(Array.from(map.values()).sort((a, b) => b.total_primes - a.total_primes))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (tenantId) load() }, [tenantId, load])

  const displayed = clients.filter(c =>
    !search || c.assure_nom.toLowerCase().includes(search.toLowerCase()) ||
    c.assure_email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
            <Users className="text-[#DC2626]" size={22} /> Clients & Assurés
          </h1>
          <p className="text-sm text-[#64748B]">{clients.length} client{clients.length !== 1 ? 's' : ''} dans le portefeuille</p>
        </div>
        <button onClick={load} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 self-start">
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#DC2626]' : 'text-[#64748B]'} />
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un assuré..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-[#DC2626]" size={24} /></div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <Users size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucun client trouvé</p>
          </div>
        ) : displayed.map(c => (
          <div key={c.assure_nom} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => setExpanded(expanded === c.assure_nom ? null : c.assure_nom)}>
              <div className="w-10 h-10 rounded-full bg-[#DC2626] flex items-center justify-center text-white font-black text-sm shrink-0">
                {c.assure_nom.slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[#0F172A]">{c.assure_nom}</div>
                <div className="flex flex-wrap gap-3 text-xs text-[#64748B] mt-1">
                  {c.assure_email && <span className="flex items-center gap-1"><Mail size={11}/>{c.assure_email}</span>}
                  {c.assure_telephone && <span className="flex items-center gap-1"><Phone size={11}/>{c.assure_telephone}</span>}
                  <span className="capitalize bg-gray-100 px-1.5 py-0.5 rounded font-medium">{c.assure_type}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-black text-[#0F172A]">{fmt(c.total_primes)} FCFA</div>
                <div className="text-xs text-[#64748B]">{c.polices.length} police{c.polices.length !== 1 ? 's' : ''} · {c.nb_actives} active{c.nb_actives !== 1 ? 's' : ''}</div>
              </div>
              <ChevronRight size={16} className={`text-[#94A3B8] transition-transform shrink-0 ${expanded === c.assure_nom ? 'rotate-90' : ''}`} />
            </div>

            {expanded === c.assure_nom && (
              <div className="border-t border-gray-50 bg-gray-50/50 p-4">
                <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3">Polices ({c.polices.length})</div>
                <div className="space-y-2">
                  {c.polices.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100">
                      <Shield size={14} className="text-[#DC2626] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono font-bold text-[#DC2626]">{p.numero_police ?? '—'}</div>
                        <div className="text-xs text-[#64748B]">{TYPE_LABELS[p.type_police] ?? p.type_police} · Échéance {new Date(p.date_echeance).toLocaleDateString('fr-FR')}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-[#0F172A]">{fmt(p.prime_montant)} FCFA</div>
                        <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
                          p.statut === 'active' ? 'bg-green-100 text-green-700' :
                          p.statut === 'suspendue' ? 'bg-yellow-100 text-yellow-700' :
                          p.statut === 'resiliee' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>{p.statut}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
