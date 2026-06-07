'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DeclarationsMensuelleRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/fiscalite/tva') }, [router])
  return null
}
