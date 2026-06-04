'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Les virements sont désormais dans Banques → onglet Virements */
export default function VirementsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/tresorerie/banques?tab=virements') }, [router])
  return null
}
