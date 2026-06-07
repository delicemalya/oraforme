'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DeclarationsPatentRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/fiscalite/patente') }, [router])
  return null
}
