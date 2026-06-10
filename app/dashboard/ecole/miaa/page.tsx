'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EcoleMIAARedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/miaa?context=ecole') }, [router])
  return null
}
