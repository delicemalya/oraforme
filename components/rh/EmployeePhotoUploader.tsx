'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

interface Props {
  value: string
  nom?: string
  onChange: (url: string) => void
  tenantId: string
}

export function EmployeePhotoUploader({ value, nom = '', onChange, tenantId }: Props) {
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2']
  const color  = nom ? COLORS[nom.charCodeAt(0) % COLORS.length] : '#2563EB'
  const initial = nom.charAt(0).toUpperCase() || '?'

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image trop lourde. Maximum 5 MB.'); return }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      alert('Format accepté : PNG, JPG, WebP'); return
    }
    setLoading(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `photos/${tenantId}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      onChange(publicUrl)
    } catch (err) {
      console.error('Employee photo upload error:', err)
      alert('Erreur upload photo. Vérifiez que le bucket "logos" est public dans Supabase Storage.')
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 mb-3">
      <div
        className="relative cursor-pointer group"
        onClick={() => fileRef.current?.click()}
        title="Cliquez pour ajouter une photo"
      >
        {/* Avatar circle */}
        <div
          className="w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-[#E2E8F0] group-hover:border-[#F59E0B] transition-colors"
        >
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-[#F8FAFC]">
              <Loader2 size={24} className="animate-spin text-[#F59E0B]" />
            </div>
          ) : value ? (
            <img src={value} alt={nom} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-bold text-2xl"
              style={{ background: color + '20', color }}
            >
              {initial}
            </div>
          )}
        </div>

        {/* Camera badge */}
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#F59E0B] flex items-center justify-center shadow-md ring-2 ring-white">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
      </div>

      <p className="text-[10px] text-[#94A3B8]">PNG, JPG, WebP — max 5 MB</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
