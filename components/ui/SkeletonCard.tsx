export default function SkeletonCard() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#F0F4FF] animate-pulse" />
        <div className="w-14 h-4 rounded-full bg-[#F0F4FF] animate-pulse" />
      </div>
      <div className="w-20 h-7 rounded-lg bg-[#F0F4FF] animate-pulse mb-2" />
      <div className="w-28 h-2.5 rounded bg-[#1C2128] animate-pulse mb-1" />
      <div className="w-16 h-2.5 rounded bg-[#1C2128] animate-pulse" />
    </div>
  )
}
