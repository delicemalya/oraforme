'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HotelMIAARedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/miaa?context=hotel') }, [router])
  return null
}
