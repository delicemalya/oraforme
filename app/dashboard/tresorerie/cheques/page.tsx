'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Les chèques sont désormais dans Banques → onglet Chèques */
export default function ChequesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/tresorerie/banques?tab=cheques') }, [router])
  return null
}
