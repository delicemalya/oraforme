'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MIAAAssistant from './MIAAAssistant'
import { usePathname } from 'next/navigation'

function detectModule(path: string): string {
  if (path.includes('/comptabilite'))          return 'comptabilite'
  if (path.includes('/recrutement'))           return 'recrutement'
  if (path.includes('/rh'))                    return 'rh'
  if (path.includes('/facturation'))           return 'facturation'
  if (path.includes('/restaurant'))            return 'restaurant'
  if (path.includes('/ecole'))                 return 'ecole'
  if (path.includes('/stock'))                 return 'stock'
  if (path.includes('/tresorerie'))            return 'tresorerie'
  if (path.includes('/sante'))                 return 'sante'
  if (path.includes('/fiscalite'))             return 'fiscalite'
  if (path.includes('/audit'))                 return 'audit'
  if (path.includes('/crm'))                   return 'crm'
  if (path.includes('/hotel'))                 return 'hotel'
  if (path.includes('/pharmacie'))             return 'sante'
  if (path.includes('/depenses'))              return 'depenses'
  if (path.includes('/btp'))                   return 'comptabilite'
  if (path.includes('/banque'))                return 'tresorerie'
  if (path.includes('/agriculture'))           return 'stock'
  if (path.includes('/cabinet'))               return 'comptabilite'
  if (path.includes('/assurance'))             return 'assurance'
  return 'auto'
}

export default function MIAAWidget() {
  const pathname = usePathname()
  const module   = detectModule(pathname ?? '')
  const [tenantData, setTenantData] = useState<{ tenant_id?: string; secteur?: string } | undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('tenants(id, secteur_activite)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const t = (data?.tenants as { id?: string; secteur_activite?: string } | null)
      if (t?.id) setTenantData({ tenant_id: t.id, secteur: t.secteur_activite ?? undefined })
    })
  }, [])

  return (
    <MIAAAssistant
      tenantData={tenantData}
      module={module}
    />
  )
}
