'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Building2, Globe, MapPin, Layers } from 'lucide-react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useEntityHierarchy, getAncestors, getChildren, type EntityNode } from '@/lib/hooks/useEntityHierarchy'

const TYPE_ICON: Record<string, React.ReactNode> = {
  groupe:   <Globe     size={11} />,
  societe:  <Building2 size={11} />,
  filiale:  <Layers    size={11} />,
  agence:   <MapPin    size={11} />,
}

const TYPE_LABEL: Record<string, string> = {
  groupe:     'Groupe',
  societe:    'Société',
  filiale:    'Filiale',
  agence:     'Agence',
  standalone: 'Entreprise',
}

export default function EntitySwitcher() {
  const { tenant, reload } = useTenantContext()
  const { tree, loading }  = useEntityHierarchy()
  const router             = useRouter()
  const dropRef            = useRef<HTMLDivElement>(null)
  const [open, setOpen]    = useState(false)

  const typeEntite    = tenant?.typeEntite ?? 'standalone'
  const isHierarchical = tenant != null && typeEntite !== 'standalone'

  // All hooks must be unconditional — derived data computed safely with null checks
  const ancestors  = isHierarchical ? getAncestors(tree, tenant!.tenantId) : []
  const siblings   = ancestors.length > 0
    ? getChildren(tree, ancestors[ancestors.length - 1].tenantId).filter(n => n.tenantId !== tenant!.tenantId)
    : []
  const children   = isHierarchical ? getChildren(tree, tenant!.tenantId) : []
  const switchable = [...siblings, ...children].slice(0, 10)

  // Close on outside click — must be before any early return
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Only render for hierarchical tenants
  if (!isHierarchical) return null

  const crumbs: Array<EntityNode | { tenantId: string; nomEntreprise: string; typeEntite: string }> = [
    ...ancestors,
    { tenantId: tenant!.tenantId, nomEntreprise: tenant!.nomEntreprise, typeEntite },
  ]

  async function handleSwitch(node: EntityNode) {
    setOpen(false)
    localStorage.setItem('oraforme_preferred_tenant', node.tenantId)
    await reload()
    router.push(node.typeEntite === 'groupe' ? '/dashboard/groupe' : '/dashboard')
  }

  return (
    <div className="relative flex items-center" ref={dropRef}>

      {/* ── Breadcrumb pill ───────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        disabled={loading || switchable.length === 0}
        className="flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#CBD5E1] hover:shadow-sm transition-all disabled:opacity-60 disabled:cursor-default max-w-[260px]"
      >
        {/* Ancestors (desktop only) */}
        <span className="hidden md:flex items-center gap-1">
          {crumbs.slice(0, -1).map((c, i) => (
            <span key={c.tenantId} className="flex items-center gap-1">
              {i > 0 && <span className="text-[#CBD5E1] text-[10px]">/</span>}
              <span className="text-[11px] text-[#94A3B8] font-medium truncate max-w-[80px]">
                {c.nomEntreprise}
              </span>
            </span>
          ))}
          {crumbs.length > 1 && <span className="text-[#CBD5E1] text-[10px]">/</span>}
        </span>

        {/* Current entity */}
        <span className="flex items-center gap-1.5 text-[#0F172A]">
          <span className="text-[#F59E0B]">{TYPE_ICON[typeEntite] ?? TYPE_ICON.standalone}</span>
          <span className="text-[12px] font-semibold truncate max-w-[110px]">
            {tenant!.nomEntreprise}
          </span>
          <span
            className="hidden sm:inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: '#FEF3C7', color: '#92400E' }}
          >
            {TYPE_LABEL[typeEntite] ?? typeEntite}
          </span>
        </span>

        {switchable.length > 0 && (
          <ChevronDown
            size={11}
            className="text-[#94A3B8] shrink-0 transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        )}
      </button>

      {/* ── Dropdown ─────────────────────────────────────────── */}
      {open && switchable.length > 0 && (
        <div
          className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-2xl border border-[#E8ECF0] z-50 overflow-hidden"
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <div className="px-3 py-2.5 border-b border-[#F1F5F9]">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
              Changer d&apos;entité
            </p>
          </div>

          <div className="py-1.5 max-h-64 overflow-y-auto">
            {switchable.map(node => (
              <button
                key={node.tenantId}
                onClick={() => handleSwitch(node)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFC] transition-colors text-left"
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#FEF3C7', color: '#D97706' }}
                >
                  {TYPE_ICON[node.typeEntite] ?? <Building2 size={12} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#0F172A] truncate">
                    {node.nomEntreprise}
                  </p>
                  <p className="text-[10px] text-[#94A3B8]">
                    {TYPE_LABEL[node.typeEntite] ?? node.typeEntite}
                    {node.depth > 1 && ` · Niveau ${node.depth}`}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Lien vue groupe */}
          {typeEntite === 'groupe' && (
            <>
              <div className="border-t border-[#F1F5F9]" />
              <div className="p-1.5">
                <button
                  onClick={() => { setOpen(false); router.push('/dashboard/groupe') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-[#F59E0B] hover:bg-[#FFFBEB] transition-colors"
                >
                  <Globe size={13} />
                  Vue consolidée groupe
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
