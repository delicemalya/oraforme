'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SanteMIAARedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/miaa?context=sante') }, [router])
  return null
}
