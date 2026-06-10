'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RestaurantMIAARedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/miaa?context=restaurant') }, [router])
  return null
}
