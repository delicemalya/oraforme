'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function HospitalisationsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/sante/hospitalisation') }, [router])
  return (
    <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
    </div>
  )
}
