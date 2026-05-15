import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import Header from '@/components/dashboard/Header'
import AiAssistant from '@/components/ui/AiAssistant'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth guard — defense-in-depth (proxy.ts is the primary guard)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div id="dashboard-shell" className="flex h-screen bg-[#0D1117] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
      {/* MIAA+ floating assistant — available on all dashboard pages */}
      <AiAssistant />
    </div>
  )
}
