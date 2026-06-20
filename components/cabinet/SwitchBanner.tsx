'use client'

import { useCabinetSwitch } from '@/lib/cabinet/switch-context'
import { Building2, Loader2, ArrowLeft } from 'lucide-react'

/**
 * Bannière persistante affichée quand le cabinet est dans le compte d'un client.
 * À placer dans le layout dashboard cabinet.
 */
export function CabinetSwitchBanner() {
  const { switched, exitClient, isSwitching } = useCabinetSwitch()
  if (!switched) return null

  const expiresIn = Math.max(0, Math.floor((new Date(switched.expires_at).getTime() - Date.now()) / 60000))

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 py-2.5 text-white"
      style={{ background: 'linear-gradient(90deg, #B45309 0%, #D97706 100%)' }}>

      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
          <Building2 size={14} />
        </div>
        <div>
          <p className="text-[12px] font-black">Mode Expert — Compte client</p>
          <p className="text-[11px] text-amber-100">{switched.nom_entreprise} · Session expire dans {expiresIn} min</p>
        </div>
      </div>

      <button onClick={exitClient} disabled={isSwitching}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-[12px] font-bold transition-all disabled:opacity-50">
        {isSwitching
          ? <Loader2 size={12} className="animate-spin" />
          : <><ArrowLeft size={12} /> Retour Cabinet</>
        }
      </button>
    </div>
  )
}

/** Bouton "Entrer dans le compte" pour les cartes client */
export function EnterClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { enterClient, isSwitching, switched } = useCabinetSwitch()
  const isActive = switched?.client_id === clientId

  return (
    <button
      onClick={() => !isActive && enterClient(clientId)}
      disabled={isSwitching}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
        isActive
          ? 'bg-amber-100 text-amber-700 border border-amber-300'
          : 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
      } disabled:opacity-50`}
      title={`Entrer dans le compte de ${clientName}`}>
      {isSwitching ? <Loader2 size={11} className="animate-spin" /> : <Building2 size={11} />}
      {isActive ? 'Actif' : 'Accéder'}
    </button>
  )
}
