import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#21262D] flex items-center justify-center mb-4">
        <Icon size={24} className="text-[#484F58]" />
      </div>
      <p className="text-sm font-medium text-[#E6EDF3] mb-1">{title}</p>
      <p className="text-xs text-[#8B949E] mb-6 max-w-xs">{description}</p>
      {action}
    </div>
  )
}
