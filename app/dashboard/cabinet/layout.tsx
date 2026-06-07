import { CabinetSwitchProvider } from '@/lib/cabinet/switch-context'
import { CabinetSwitchBanner } from '@/components/cabinet/SwitchBanner'
import type { ReactNode } from 'react'

/**
 * Layout cabinet — fournit le contexte switch-tenant (Mode Expert)
 * et affiche la bannière persistante quand le cabinet est dans un compte client.
 */
export default function CabinetLayout({ children }: { children: ReactNode }) {
  return (
    <CabinetSwitchProvider>
      <CabinetSwitchBanner />
      <div className="cabinet-mode">
        {children}
      </div>
    </CabinetSwitchProvider>
  )
}
