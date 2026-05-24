import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'
import { Shield, Bell, Settings, ExternalLink } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? '')) {
    redirect('/dashboard')
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>
      <AdminSidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Premium Topbar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 shrink-0 gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {/* Mobile spacer */}
          <div className="w-8 lg:hidden shrink-0" />

          {/* Status indicators */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-200 bg-green-50">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[11px] font-semibold text-green-700">Système opérationnel</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50">
              <Shield size={11} className="text-amber-600" />
              <span className="text-[11px] font-semibold text-amber-700">Owner Access</span>
            </div>
          </div>

          <div className="flex-1" />

          {/* Date/time */}
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[12px] font-semibold text-gray-700">{timeStr}</span>
            <span className="text-[10px] text-gray-400 capitalize">{dateStr}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
            >
              <ExternalLink size={12} />
              <span className="hidden md:inline">Supabase</span>
            </a>

            <button className="relative p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
              <Bell size={15} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>

            <button className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
              <Settings size={15} />
            </button>

            {/* Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
                {(user.email ?? 'A')[0].toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-[12px] font-semibold text-gray-800 leading-none">{user.email?.split('@')[0]}</p>
                <p className="text-[10px] text-gray-400">Super Owner</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1440px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
