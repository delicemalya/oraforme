'use client'

import { useState } from 'react'
import { Globe, X } from 'lucide-react'
import { usePays } from '@/lib/contexts/PaysContext'

export default function GeoDetectionBanner() {
  const { paysGeo, detected, loading } = usePays()
  const [dismissed, setDismissed] = useState(false)

  if (loading || !detected || dismissed) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium mb-2"
      style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534' }}
    >
      <Globe size={13} className="shrink-0" />
      <span>
        Pays détecté automatiquement : <strong>{paysGeo.drapeau} {paysGeo.nom}</strong> — devise {paysGeo.devise}.{' '}
        Vous pouvez changer via le sélecteur en haut à droite.
      </span>
      <button onClick={() => setDismissed(true)} className="ml-auto shrink-0 hover:text-green-900">
        <X size={13} />
      </button>
    </div>
  )
}
