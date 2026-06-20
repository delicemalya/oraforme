'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'

export function LogoUploader() {
  const { tenant } = useTenantContext()
  const [logoUrl,  setLogoUrl]  = useState<string | null>(null)
  const [preview,  setPreview]  = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const tenantId = tenant?.tenantId ?? null
  const nom      = tenant?.nomEntreprise ?? ''
  const initials = nom.slice(0, 2).toUpperCase() || 'EN'

  useEffect(() => {
    if (!tenantId) return
    supabase
      .from('entreprise_config')
      .select('logo_url')
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then(({ data }) => setLogoUrl(data?.logo_url ?? null))

    function onSaved(e: Event) {
      const url = (e as CustomEvent<{ logo_url: string | null }>).detail?.logo_url
      setLogoUrl(url ?? null)
    }
    window.addEventListener('oraforme:config-saved', onSaved)
    return () => window.removeEventListener('oraforme:config-saved', onSaved)
  }, [tenantId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return
    if (file.size > 2 * 1024 * 1024) { alert('Logo trop lourd. Maximum 2 MB.'); return }
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      alert('Format accepté : PNG, JPG, SVG, WebP'); return
    }
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setLoading(true); setShowMenu(false)
    try {
      const ext  = file.name.split('.').pop() ?? 'png'
      const path = `logos/${tenantId}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      await supabase.from('entreprise_config')
        .upsert({ tenant_id: tenantId, logo_url: publicUrl }, { onConflict: 'tenant_id' })
      setLogoUrl(publicUrl); setPreview(null)
      window.dispatchEvent(new CustomEvent('oraforme:config-saved', { detail: { logo_url: publicUrl } }))
    } catch (err) {
      console.error('Logo upload error:', err)
      alert('Erreur upload. Vérifiez que le bucket "logos" est public dans Supabase Storage.')
      setPreview(null)
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function supprimerLogo() {
    if (!tenantId) return
    setShowMenu(false)
    if (!confirm('Supprimer le logo ?')) return
    await supabase.from('entreprise_config').update({ logo_url: null }).eq('tenant_id', tenantId)
    setLogoUrl(null)
    window.dispatchEvent(new CustomEvent('oraforme:config-saved', { detail: { logo_url: null } }))
  }

  if (!nom) return null

  const src = preview || logoUrl

  return (
    <div className="relative hidden sm:flex items-center gap-2 shrink-0">

      {/* ── Zone logo cliquable ── */}
      <div
        className="relative cursor-pointer"
        onClick={() => setShowMenu(v => !v)}
        title="Cliquez pour changer votre logo"
      >
        {/* Conteneur logo : bordure pointillée si pas de logo */}
        <div
          className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center transition-all"
          style={{
            border: src ? '2px solid var(--primary-light)' : '2px dashed var(--primary)',
            background: src ? undefined : 'var(--primary-light)',
          }}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--primary)' }} />
          ) : src ? (
             
            <img src={src} alt={nom} className="w-full h-full object-contain p-0.5" />
          ) : (
            <span className="text-[10px] font-bold" style={{ color: 'var(--primary)' }}>
              {initials}
            </span>
          )}
        </div>

        {/* Badge caméra TOUJOURS visible — indique que c'est modifiable */}
        <div
          className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-md ring-2 ring-white"
          style={{ background: 'var(--primary)' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
      </div>

      {/* Label cliquable — rend l'action évidente d'un coup d'œil */}
      <button
        onClick={() => setShowMenu(v => !v)}
        className="flex flex-col items-start leading-tight hover:opacity-75 transition-opacity"
      >
        <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
          📸 Modifier
        </span>
        <span className="text-[10px] font-bold text-[#0F172A] max-w-[110px] truncate">{nom}</span>
      </button>

      {/* ── Menu contextuel ── */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            className="absolute left-0 top-12 z-50 bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-52 overflow-hidden"
            style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
          >
            <div className="px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <p className="text-[10px] font-medium text-[#94A3B8]">Logo de l&apos;entreprise</p>
            </div>

            <button
              onClick={() => { setShowMenu(false); fileRef.current?.click() }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-base">📸</div>
              <div>
                <p className="text-sm font-medium text-[#0F172A]">
                  {logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
                </p>
                <p className="text-[10px] text-[#94A3B8]">PNG, JPG, SVG — Max 2 MB</p>
              </div>
            </button>

            {logoUrl && (
              <button
                onClick={supprimerLogo}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left border-t border-[#F1F5F9]"
              >
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-base">🗑️</div>
                <p className="text-sm font-medium text-red-500">Supprimer le logo</p>
              </button>
            )}

            <div className="px-4 py-2 bg-[#F8FAFC] border-t border-[#E2E8F0]">
              <p className="text-[10px] text-[#94A3B8]">💡 Apparaît sur vos factures et documents</p>
            </div>
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
