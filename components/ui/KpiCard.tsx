'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: number
  sub?: string
  icon: LucideIcon
  color: string
  trend?: string
  trendUp?: boolean
  formatter?: (v: number) => string
  delay?: number
}

function useCounter(target: number, duration = 1000, delay = 0) {
  const [val, setVal] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (target === 0) return
    const tid = setTimeout(() => {
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1)
        const eased = 1 - (1 - p) ** 3
        setVal(Math.round(eased * target))
        if (p < 1) rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }, delay)
    return () => {
      clearTimeout(tid)
      cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, delay])

  return val
}

export default function KpiCard({
  label, value, sub, icon: Icon, color, trend, trendUp = true, formatter, delay = 0,
}: Props) {
  const count = useCounter(value, 1000, delay)
  const display = formatter ? formatter(count) : count.toLocaleString('fr-FR')

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ scale: 1.025, y: -2, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
      className="relative bg-[#161B22] border border-[#30363D] rounded-xl p-4 overflow-hidden cursor-default select-none"
      style={{ willChange: 'transform', transition: 'box-shadow 0.25s ease, border-color 0.25s ease' }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = `0 0 32px ${color}18, 0 4px 16px ${color}0C`
        el.style.borderColor = `${color}45`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = ''
        el.style.borderColor = '#30363D'
      }}
    >
      {/* Radial bg glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 0% 0%, ${color}09 0%, transparent 60%)` }}
      />

      <div className="flex items-start justify-between mb-3 relative">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${color}2A, ${color}0F)` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        {trend && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0"
            style={{
              color: trendUp ? '#0D2147' : '#F01F38',
              backgroundColor: trendUp ? '#0D214718' : '#F01F3818',
            }}
          >
            {trendUp ? '▲' : '▼'} {trend}
          </span>
        )}
      </div>

      <p className="text-2xl font-bold leading-none relative" style={{ color }}>{display}</p>
      <p className="text-[10px] text-[#484F58] mt-1.5 uppercase tracking-wider font-semibold relative">{label}</p>
      {sub && <p className="text-[10px] text-[#8B949E] mt-0.5 relative truncate">{sub}</p>}
    </motion.div>
  )
}
