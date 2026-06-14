'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import ProfilCompletionBanner from './ProfilCompletionBanner'
import ProfilCompletionPopup  from './ProfilCompletionPopup'

export default function CompletionLayer({ children }: { children: ReactNode }) {
  const [popupOpen, setPopupOpen] = useState(false)

  return (
    <>
      <ProfilCompletionBanner onOpen={() => setPopupOpen(true)} />
      {children}
      <ProfilCompletionPopup open={popupOpen} onClose={() => setPopupOpen(false)} />
    </>
  )
}
