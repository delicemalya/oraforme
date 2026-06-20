export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-10 h-10 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin"
          role="status"
          aria-label="Chargement"
        />
        <p className="text-sm text-slate-500 font-medium">Chargement…</p>
      </div>
    </div>
  )
}
