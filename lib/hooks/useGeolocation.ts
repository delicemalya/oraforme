'use client'

import { useState, useEffect } from 'react'
import { mapIpCountryToAppCode } from '@/lib/geolocation'

const STORAGE_KEY = 'oraforme-pays'
const DEFAULT_PAYS = 'CG'

export function useGeolocation() {
  const [pays, setPaysState] = useState<string>(DEFAULT_PAYS)
  const [detected, setDetected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setPaysState(stored)
      setLoading(false)
      setDetected(false)
      return
    }

    // IP detection with 5 s timeout
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5_000)

    fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      .then(r => r.json())
      .then((data: { country_code?: string }) => {
        if (data.country_code) {
          const code = mapIpCountryToAppCode(data.country_code)
          setPaysState(code)
          setDetected(true)
          localStorage.setItem(STORAGE_KEY, code)
        }
      })
      .catch(() => {
        // Fallback: keep default CG
      })
      .finally(() => {
        clearTimeout(timer)
        setLoading(false)
      })
  }, [])

  function setPays(code: string) {
    setPaysState(code)
    localStorage.setItem(STORAGE_KEY, code)
    setDetected(false)
  }

  return { pays, setPays, detected, loading }
}
