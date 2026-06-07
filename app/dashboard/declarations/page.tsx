'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DeclarationsRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/fiscalite') }, [router])
  return null
}
