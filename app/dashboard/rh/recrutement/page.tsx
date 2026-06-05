'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Briefcase, Users, Calendar, Bot, FileText, Plus, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

export default function RecrutementPage() {
  const { tenantId, loading } = useTenant()
  const [stats, setStats] = useState({ offres: 0, candidats: 0, candidatures: 0, entretiens: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    async function load() {
      const [o, ca, cu, e] = await Promise.all([
        supabase.from('offres_emploi').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'active'),
        supabase.from('candidats').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('candidatures').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('entretiens').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'planifie'),
      ])
      setStats({ offres: o.count ?? 0, candidats: ca.count ?? 0, candidatures: cu.count ?? 0, entretiens: e.count ?? 0 })
      setLoadingStats(false)
    }
    load()
  }, [tenantId])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
    </div>
  )

  const CARDS = [
    { href: '/dashboard/rh/recrutement/offres', label: 'Offres d\'emploi', desc: 'Gérez vos postes ouverts', icon: Briefcase, stat: stats.offres, statLabel: 'actives', color: '#F59E0B' },
    { href: '/dashboard/rh/recrutement/cvtheque', label: 'CVthèque', desc: 'Analysez les CV avec l\'IA', icon: Users, stat: stats.candidats, statLabel: 'candidats', color: '#2563EB' },
    { href: '/dashboard/rh/recrutement/candidatures', label: 'Candidatures', desc: 'Suivez le pipeline RH', icon: FileText, stat: stats.candidatures, statLabel: 'reçues', color: '#16A34A' },
    { href: '/dashboard/rh/recrutement/entretiens', label: 'Entretiens', desc: 'Planifiez et évaluez', icon: Calendar, stat: stats.entretiens, statLabel: 'planifiés', color: '#DC2626' },
    { href: '/dashboard/rh/recrutement/miaa-job', label: 'MIAA Job', desc: 'Tableau de bord IA', icon: Bot, stat: null, statLabel: '', color: '#8B5CF6' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0F172A]">🎯 Recrutement IA</h1>
          <p className="text-xs text-[#64748B] mt-0.5">Module MIAA Job — Recrutement intelligent alimenté par l'IA</p>
        </div>
        <Link
          href="/dashboard/rh/recrutement/offres/nouvelle"
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors"
        >
          <Plus size={13} /> Nouvelle offre
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(card => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-white border border-[#E2E8F0] rounded-xl p-5 hover:border-[#CBD5E1] hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${card.color}15` }}>
                  <Icon size={18} style={{ color: card.color }} />
                </div>
                <ArrowRight size={14} className="text-[#CBD5E1] group-hover:text-[#94A3B8] transition-colors mt-1" />
              </div>
              <p className="text-sm font-semibold text-[#0F172A]">{card.label}</p>
              <p className="text-xs text-[#64748B] mt-0.5 mb-3">{card.desc}</p>
              {card.stat !== null && (
                <p className="text-2xl font-bold" style={{ color: card.color }}>
                  {loadingStats ? '—' : card.stat}
                  <span className="text-xs font-normal text-[#94A3B8] ml-1.5">{card.statLabel}</span>
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
