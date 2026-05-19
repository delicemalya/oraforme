import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? '')) {
    redirect('/dashboard')
  }

  return (
    <div className="flex h-screen bg-[#142850] overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Admin header */}
        <header className="h-14 bg-[#0f1e3d] border-b border-[#30363D] flex items-center px-4 lg:px-6 shrink-0">
          <div className="w-8 lg:hidden shrink-0" />
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#F51E33] animate-pulse" />
            <span className="text-sm font-medium text-[#FFFFFF]">Panneau Super Admin</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F51E33]/20 border border-[#F51E33]/30 flex items-center justify-center">
              <span className="text-[#F51E33] text-xs font-bold">A</span>
            </div>
            <span className="text-sm text-[#8B949E] hidden sm:block">{user.email}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
