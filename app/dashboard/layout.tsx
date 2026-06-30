import { Suspense } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import Header from '@/components/dashboard/Header'
import BackButtonBar from '@/components/dashboard/BackButtonBar'
import MIAAWidget from '@/components/miaa/MIAAWidget'
import DashboardShell from '@/components/dashboard/DashboardShell'
import CompletionLayer from '@/components/dashboard/CompletionLayer'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth guard — defense-in-depth (middleware.ts is the primary guard)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    // DashboardShell provides TenantContext (client-side, reactive to auth changes)
    // This is the single source of truth for tenant identity across all dashboard components.
    <DashboardShell>
      <div id="dashboard-shell" className="flex h-screen bg-[#F8FAFC] overflow-hidden">
        <Sidebar />
        <div id="main-content" className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header />
          {/* CompletionLayer: banner 72h + popup finalisation entreprise */}
          <CompletionLayer>
            <main className="flex-1 overflow-y-auto">
              <div className="p-4 lg:p-6 page-transition">
                <BackButtonBar />
                <Suspense fallback={null}>
                  {children}
                </Suspense>
              </div>
            </main>
          </CompletionLayer>
        </div>
        {/* MIAA+ Super Agent — floating widget with 5 tabs */}
        <MIAAWidget />
      </div>
    </DashboardShell>
  )
}
